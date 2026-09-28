import { Request, Response, NextFunction } from 'express';
import { db } from '../db/index.ts';
import { sql } from 'drizzle-orm';
import { AuthRequest } from './auth.ts';

/**
 * SISTEMA DISTRIBUÍDO DE RATE LIMITING BASEADO EM POSTGRESQL
 * 
 * Substitui os contadores voláteis em memória por persistência compartilhada
 * na tabela 'rate_limit_buckets' do Cloud SQL PostgreSQL.
 * 
 * Garantias:
 * 1. Atomicidade contra concorrência (sem lost updates via ON CONFLICT DO UPDATE).
 * 2. Isolamento seguro entre tenants (tenantId + user / tenantId + ip).
 * 3. Persistência de bloqueios mesmo entre reinicializações de processo ou réplicas distribuídas.
 * 4. Zero armazenamento de credenciais sensíveis (PIN ou tokens).
 */

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message: string;
  scope: string;
  keyGenerator?: (req: Request) => string;
  failMode?: 'open' | 'closed';
}

export class SecurityInfrastructureError extends Error {
  readonly isSecurityInfrastructure = true;
  constructor(message: string = 'Serviço de segurança temporariamente indisponível. Tente novamente.') {
    super(message);
    this.name = 'SecurityInfrastructureError';
  }
}

/**
 * Executa incremento atômico de rate limiting no PostgreSQL
 */
export async function atomicIncrementRateLimit(params: {
  key: string;
  scope: string;
  windowMs: number;
  maxAttempts?: number;
}): Promise<{
  attempts: number;
  windowStartedAt: Date;
  blockedUntil: Date | null;
  isBlocked: boolean;
  retryAfterSeconds: number;
}> {
  const { key, scope, windowMs } = params;

  const result = await db.execute(sql`
    INSERT INTO rate_limit_buckets (key, scope, attempts, window_started_at, blocked_until, created_at, updated_at)
    VALUES (${key}, ${scope}, 1, NOW(), NULL, NOW(), NOW())
    ON CONFLICT (key, scope) DO UPDATE
    SET 
      attempts = CASE 
        WHEN NOW() > rate_limit_buckets.window_started_at + (${windowMs} || ' milliseconds')::interval 
        THEN 1 
        ELSE rate_limit_buckets.attempts + 1 
      END,
      window_started_at = CASE 
        WHEN NOW() > rate_limit_buckets.window_started_at + (${windowMs} || ' milliseconds')::interval 
        THEN NOW() 
        ELSE rate_limit_buckets.window_started_at 
      END,
      updated_at = NOW()
    RETURNING attempts, window_started_at, blocked_until;
  `);

  const row = result.rows[0] as any;
  const attempts = Number(row.attempts);
  const windowStartedAt = new Date(row.window_started_at);
  const blockedUntil = row.blocked_until ? new Date(row.blocked_until) : null;

  const nowMs = Date.now();
  const resetTimeMs = windowStartedAt.getTime() + windowMs;
  const retryAfterSeconds = Math.max(1, Math.ceil((resetTimeMs - nowMs) / 1000));

  return {
    attempts,
    windowStartedAt,
    blockedUntil,
    isBlocked: false,
    retryAfterSeconds
  };
}

/**
 * Cria middleware Express de Rate Limiting conectado ao PostgreSQL
 */
export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, max, message, scope, failMode = 'closed' } = options;

  const keyGen = options.keyGenerator || ((req: Request) => {
    const authReq = req as AuthRequest;
    const tenantId = authReq.user?.tenantId || 'global';
    const identifier = authReq.user?.uid ? `user:${authReq.user.uid}` : `ip:${req.ip || 'unknown'}`;
    return `${tenantId}:${identifier}`;
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = keyGen(req);
      const { attempts, windowStartedAt, retryAfterSeconds } = await atomicIncrementRateLimit({
        key,
        scope,
        windowMs
      });

      const remaining = Math.max(0, max - attempts);
      const resetUnixSeconds = Math.ceil((windowStartedAt.getTime() + windowMs) / 1000);

      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetUnixSeconds);

      if (attempts > max) {
        res.setHeader('Retry-After', retryAfterSeconds);
        return res.status(429).json({
          sucesso: false,
          erro: message,
          retryAfterSegundos: retryAfterSeconds
        });
      }

      next();
    } catch (error: any) {
      console.error(`[RateLimiter Error] Falha na verificação de limite para scope=${scope}:`, error);
      if (failMode === 'closed') {
        return res.status(503).json({
          sucesso: false,
          erro: 'Serviço de segurança temporariamente indisponível. Tente novamente.'
        });
      }
      // Fail-open com justificativa técnica documentada (apenas para rotas públicas/healthcheck)
      next();
    }
  };
}

// ============================================================================
// RATE LIMITERS GERAIS COMPARTILHADOS (POSTGRESQL)
// ============================================================================

// 1. Rate Limiter para Autenticação Sensível - 30 req/min (Fail-Closed)
export const authRateLimiter = createRateLimiter({
  scope: 'auth',
  windowMs: 60 * 1000,
  max: 30,
  failMode: 'closed',
  message: 'Muitas tentativas de autenticação. Aguarde um momento antes de tentar novamente.',
  keyGenerator: (req) => {
    const authReq = req as AuthRequest;
    const tenantId = authReq.user?.tenantId || 'global';
    return `${tenantId}:auth:${req.ip || 'unknown'}`;
  }
});

// 2. Rate Limiter para Criação de Vendas - 60 vendas/min por operador (Fail-Closed)
export const salesRateLimiter = createRateLimiter({
  scope: 'sales',
  windowMs: 60 * 1000,
  max: 60,
  failMode: 'closed',
  message: 'Limite de processamento de vendas por minuto atingido. Aguarde alguns segundos.',
  keyGenerator: (req) => {
    const authReq = req as AuthRequest;
    const tenantId = authReq.user?.tenantId || 'global';
    return `${tenantId}:sales:${authReq.user?.uid || req.ip || 'unknown'}`;
  }
});

// 3. Rate Limiter para Endpoints Administrativos - 60 req/min (Fail-Closed)
export const adminRateLimiter = createRateLimiter({
  scope: 'admin',
  windowMs: 60 * 1000,
  max: 60,
  failMode: 'closed',
  message: 'Limite de requisições administrativas excedido. Tente novamente mais tarde.',
  keyGenerator: (req) => {
    const authReq = req as AuthRequest;
    const tenantId = authReq.user?.tenantId || 'global';
    return `${tenantId}:admin:${authReq.user?.uid || req.ip || 'unknown'}`;
  }
});

/**
 * 4. Rate Limiter para APIs Públicas e Healthchecks - 120 req/min por IP
 * 
 * Justificativa técnica explícita para failMode: 'open':
 * Endpoints públicos não-autenticados de telemetria e integridade (ex: /api/health)
 * são consultados continuamente por balanceadores de carga e orquestradores.
 * Em caso de indisponibilidade transitória do storage do rate limiter,
 * prioriza-se a disponibilidade da rota de monitoramento para evitar falso-positivo
 * de queda total do container.
 */
export const publicRateLimiter = createRateLimiter({
  scope: 'public',
  windowMs: 60 * 1000,
  max: 120,
  failMode: 'open',
  message: 'Muitas requisições ao servidor. Aguarde alguns instantes.',
  keyGenerator: (req) => `public:${req.ip || 'unknown'}`
});

// ============================================================================
// PROTEÇÃO ATÔMICA CONTRA BRUTE FORCE NO PIN DE SUPERVISOR (POSTGRESQL)
// ============================================================================

function parsePinProtectionKeys(p1: string, p2?: string, p3?: string): { tenantId: string; operatorId: string; ipAddress?: string; keys: string[] } {
  let tenantId: string;
  let operatorId: string;
  let ipAddress: string | undefined;

  if (p3 !== undefined) {
    tenantId = p1 || 'global';
    operatorId = p2 || 'unknown';
    ipAddress = p3;
  } else if (p2 !== undefined) {
    if (p2.includes('.') || p2.includes(':') || p1.startsWith('user-') || p1.startsWith('op-')) {
      tenantId = 'global';
      operatorId = p1;
      ipAddress = p2;
    } else {
      tenantId = p1;
      operatorId = p2;
      ipAddress = undefined;
    }
  } else {
    tenantId = 'global';
    operatorId = p1 || 'unknown';
    ipAddress = undefined;
  }

  const keys = [`${tenantId}:user:${operatorId}`];
  if (ipAddress && ipAddress !== 'unknown') {
    keys.push(`${tenantId}:ip:${ipAddress}`);
  }

  return { tenantId, operatorId, ipAddress, keys };
}

export interface PinProtectionStatus {
  isBlocked: boolean;
  retryAfterSeconds: number;
  isUnavailable?: boolean;
}

export interface PinFailureResult {
  failures: number;
  isNowBlocked: boolean;
  retryAfterSeconds: number;
  isUnavailable?: boolean;
}

export const SupervisorPinProtection = {
  MAX_FAILURES: 5,
  LOCKOUT_MS: 5 * 60 * 1000, // 5 minutos de bloqueio temporário
  WINDOW_MS: 5 * 60 * 1000,

  /**
   * Consulta se o operador ou IP está sob bloqueio temporário de segurança.
   * Fail-Closed: se o PostgreSQL falhar, retorna isUnavailable: true impedindo acesso.
   */
  async checkBlocked(
    p1: string,
    p2?: string,
    p3?: string
  ): Promise<PinProtectionStatus> {
    const { keys } = parsePinProtectionKeys(p1, p2, p3);

    try {
      const keyList = sql.join(keys.map(k => sql`${k}`), sql`, `);
      const result = await db.execute(sql`
        SELECT key, attempts, window_started_at, blocked_until 
        FROM rate_limit_buckets
        WHERE scope = 'supervisor_pin' 
          AND key IN (${keyList})
          AND blocked_until IS NOT NULL 
          AND blocked_until > NOW()
        ORDER BY blocked_until DESC
        LIMIT 1;
      `);

      if (result.rows.length > 0) {
        const row = result.rows[0] as any;
        const blockedUntil = new Date(row.blocked_until).getTime();
        const retryAfterSeconds = Math.max(1, Math.ceil((blockedUntil - Date.now()) / 1000));
        return { isBlocked: true, retryAfterSeconds };
      }

      return { isBlocked: false, retryAfterSeconds: 0 };
    } catch (error) {
      console.error('[SupervisorPinProtection] Erro de infraestrutura ao consultar bloqueio no banco:', error);
      return { isBlocked: false, retryAfterSeconds: 0, isUnavailable: true };
    }
  },

  /**
   * Computa tentativa falha de PIN atomicamente no PostgreSQL.
   * Se atingir 5 falhas, bloqueia temporariamente por 5 minutos (HTTP 429).
   * Fail-Closed: se a gravação no PostgreSQL falhar, retorna isUnavailable: true
   * impedindo que o atacante execute tentativas ilimitadas sem contabilização.
   */
  async recordFailure(
    p1: string,
    p2?: string,
    p3?: string
  ): Promise<PinFailureResult> {
    const { keys } = parsePinProtectionKeys(p1, p2, p3);
    let maxFailures = 0;
    let isNowBlocked = false;
    let maxRetryAfter = 0;

    try {
      for (const key of keys) {
        const result = await db.execute(sql`
          INSERT INTO rate_limit_buckets (key, scope, attempts, window_started_at, blocked_until, created_at, updated_at)
          VALUES (${key}, 'supervisor_pin', 1, NOW(), NULL, NOW(), NOW())
          ON CONFLICT (key, scope) DO UPDATE
          SET 
            attempts = CASE 
              WHEN rate_limit_buckets.blocked_until IS NOT NULL AND NOW() > rate_limit_buckets.blocked_until THEN 1
              WHEN NOW() > rate_limit_buckets.window_started_at + interval '5 minutes' THEN 1
              ELSE rate_limit_buckets.attempts + 1
            END,
            window_started_at = CASE 
              WHEN rate_limit_buckets.blocked_until IS NOT NULL AND NOW() > rate_limit_buckets.blocked_until THEN NOW()
              WHEN NOW() > rate_limit_buckets.window_started_at + interval '5 minutes' THEN NOW()
              ELSE rate_limit_buckets.window_started_at
            END,
            blocked_until = CASE 
              WHEN (
                CASE 
                  WHEN rate_limit_buckets.blocked_until IS NOT NULL AND NOW() > rate_limit_buckets.blocked_until THEN 1
                  WHEN NOW() > rate_limit_buckets.window_started_at + interval '5 minutes' THEN 1
                  ELSE rate_limit_buckets.attempts + 1
                END
              ) >= 5 THEN NOW() + interval '5 minutes'
              ELSE NULL
            END,
            updated_at = NOW()
          RETURNING attempts, blocked_until;
        `);

        const row = result.rows[0] as any;
        const attempts = Number(row.attempts);
        if (attempts > maxFailures) {
          maxFailures = attempts;
        }

        if (row.blocked_until) {
          const blockedUntil = new Date(row.blocked_until).getTime();
          if (blockedUntil > Date.now()) {
            isNowBlocked = true;
            const retry = Math.max(1, Math.ceil((blockedUntil - Date.now()) / 1000));
            if (retry > maxRetryAfter) {
              maxRetryAfter = retry;
            }
          }
        }
      }

      return {
        failures: maxFailures,
        isNowBlocked,
        retryAfterSeconds: isNowBlocked ? (maxRetryAfter || 300) : 0
      };
    } catch (error) {
      console.error('[SupervisorPinProtection] Erro de infraestrutura ao registrar falha de PIN no banco:', error);
      return {
        failures: 0,
        isNowBlocked: false,
        retryAfterSeconds: 0,
        isUnavailable: true
      };
    }
  },

  /**
   * Reseta os contadores de falha no banco de dados quando o PIN correto é fornecido.
   * Fail-Closed: se o reset falhar, lança SecurityInfrastructureError para não dar
   * falso sucesso silencioso que permitiria bypass.
   */
  async resetFailures(
    p1: string,
    p2?: string,
    p3?: string
  ): Promise<void> {
    const { keys } = parsePinProtectionKeys(p1, p2, p3);

    try {
      const keyList = sql.join(keys.map(k => sql`${k}`), sql`, `);
      await db.execute(sql`
        DELETE FROM rate_limit_buckets 
        WHERE scope = 'supervisor_pin' 
          AND key IN (${keyList});
      `);
    } catch (error) {
      console.error('[SupervisorPinProtection] Erro de infraestrutura ao resetar falhas no banco:', error);
      throw new SecurityInfrastructureError('Serviço de segurança temporariamente indisponível. Tente novamente.');
    }
  }
};
