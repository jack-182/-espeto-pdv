/**
 * SUÍTE DE TESTES DE SEGURANÇA FAIL-CLOSED (FASE 1.7.2 - PDV 13)
 * 
 * Validação rigorosa dos 9 requisitos obrigatórios:
 * 1. PostgreSQL disponível → rate limit funciona.
 * 2. PostgreSQL disponível → PIN bloqueia após 5 falhas.
 * 3. PostgreSQL indisponível → endpoint sensível retorna 503.
 * 4. PostgreSQL indisponível → NÃO permite bypass do rate limit.
 * 5. PostgreSQL indisponível → checkBlocked não retorna falso silenciosamente.
 * 6. PostgreSQL indisponível → falha de persistência do PIN é tratada.
 * 7. PostgreSQL volta → proteção funciona normalmente.
 * 8. Concorrência continua funcionando.
 * 9. Rate limit distribuído continua funcionando entre conexões.
 */

import { Pool } from 'pg';
import { db } from '../src/db/index.ts';
import { sql } from 'drizzle-orm';
import {
  authRateLimiter,
  salesRateLimiter,
  adminRateLimiter,
  publicRateLimiter,
  createRateLimiter,
  SupervisorPinProtection,
  atomicIncrementRateLimit
} from '../src/middleware/rateLimiter.ts';
import { PosRepository } from '../src/db/repository.ts';

let totalPass = 0;
let totalFail = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    totalPass++;
    console.log(`[\x1b[32mPASS\x1b[0m] ${testName}`);
  } else {
    totalFail++;
    console.error(`[\x1b[31mFAIL\x1b[0m] ${testName}${detail ? ` -> ${detail}` : ''}`);
  }
}

// Helpers para simulação de requisições Express
function createMockContext(ip: string = '192.168.1.100', user?: any) {
  let statusCode = 200;
  let jsonBody: any = null;
  let nextCalled = false;
  const headers: Record<string, any> = {};

  const req: any = {
    ip,
    headers: {},
    user: user || { uid: 'usr-test-failclosed', tenantId: 'tenant-fc-test', name: 'Test User' }
  };

  const res: any = {
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (body: any) => {
      jsonBody = body;
      return res;
    },
    setHeader: (name: string, value: any) => {
      headers[name] = value;
      return res;
    },
    getHeader: (name: string) => headers[name]
  };

  const next = () => {
    nextCalled = true;
  };

  return { req, res, next, getStatus: () => statusCode, getBody: () => jsonBody, isNextCalled: () => nextCalled };
}

async function runFailClosedTests() {
  console.log('================================================================');
  console.log(' VALIDAÇÃO DE CONTROLES DE SEGURANÇA FAIL-CLOSED (FASE 1.7.2)');
  console.log('================================================================\n');

  const tenantTest = 'tenant-fc-test';
  const opTest = 'op-fc-user';
  const ipTest = '192.168.10.50';

  // Limpeza prévia
  await db.execute(sql`DELETE FROM rate_limit_buckets WHERE key LIKE '%fc-%';`);

  // ============================================================================
  // REQUISITO 1: PostgreSQL disponível → rate limit funciona
  // ============================================================================
  console.log('--- [REQUISITO 1] PostgreSQL disponível → rate limit funciona ---');
  {
    const ctx = createMockContext(ipTest, { uid: opTest, tenantId: tenantTest });
    await authRateLimiter(ctx.req, ctx.res, ctx.next);

    assert(
      ctx.isNextCalled() && ctx.getStatus() === 200,
      'authRateLimiter permite requisição legítima com banco ativo',
      `status: ${ctx.getStatus()}, nextCalled: ${ctx.isNextCalled()}`
    );
  }

  // ============================================================================
  // REQUISITO 2: PostgreSQL disponível → PIN bloqueia após 5 falhas
  // ============================================================================
  console.log('\n--- [REQUISITO 2] PostgreSQL disponível → PIN bloqueia após 5 falhas ---');
  {
    const pinUser = 'op-pin-target';
    const pinIp = '10.0.0.99';

    for (let i = 1; i <= 4; i++) {
      const failRes = await SupervisorPinProtection.recordFailure(tenantTest, pinUser, pinIp);
      assert(!failRes.isNowBlocked && failRes.failures === i, `Falha ${i}/5 registrada sem bloqueio prematuro`);
    }

    // 5ª falha deve bloquear
    const fifth = await SupervisorPinProtection.recordFailure(tenantTest, pinUser, pinIp);
    assert(
      fifth.isNowBlocked && fifth.failures >= 5 && fifth.retryAfterSeconds > 0,
      '5ª falha consecutiva ativa bloqueio de PIN no PostgreSQL (Rate Limit 429)',
      `isNowBlocked: ${fifth.isNowBlocked}, retryAfter: ${fifth.retryAfterSeconds}`
    );

    // Consulta de bloqueio confirma
    const check = await SupervisorPinProtection.checkBlocked(tenantTest, pinUser, pinIp);
    assert(
      check.isBlocked && check.retryAfterSeconds > 0 && !check.isUnavailable,
      'SupervisorPinProtection.checkBlocked confirma bloqueio ativo no PostgreSQL'
    );
  }

  // ============================================================================
  // SIMULAÇÃO DE INDISPONIBILIDADE DO POSTGRESQL
  // ============================================================================
  console.log('\n--- [SIMULAÇÃO DE FALHA DO POSTGRESQL] ---');
  const originalExecute = db.execute.bind(db);
  const dbUnavailableError = new Error('getaddrinfo ENOTFOUND cloud-sql-instance.internal (Database Unavailable)');

  const simulateDbOutage = () => {
    (db as any).execute = async () => {
      throw dbUnavailableError;
    };
  };

  const restoreDb = () => {
    (db as any).execute = originalExecute;
  };

  // Ativa indisponibilidade
  simulateDbOutage();

  // ============================================================================
  // REQUISITO 3: PostgreSQL indisponível → endpoint sensível retorna 503
  // ============================================================================
  console.log('\n--- [REQUISITO 3] PostgreSQL indisponível → endpoint sensível retorna 503 ---');
  {
    const ctxAuth = createMockContext('10.0.0.1', { uid: 'u1', tenantId: tenantTest });
    await authRateLimiter(ctxAuth.req, ctxAuth.res, ctxAuth.next);

    assert(
      ctxAuth.getStatus() === 503,
      'authRateLimiter responde HTTP 503 quando PostgreSQL está indisponível',
      `status obtido: ${ctxAuth.getStatus()}`
    );

    assert(
      ctxAuth.getBody()?.erro === 'Serviço de segurança temporariamente indisponível. Tente novamente.',
      'authRateLimiter retorna mensagem de erro segura sem expor internals do PostgreSQL',
      `body obtido: ${JSON.stringify(ctxAuth.getBody())}`
    );

    // Testa também salesRateLimiter e adminRateLimiter
    const ctxSales = createMockContext('10.0.0.2', { uid: 'u2', tenantId: tenantTest });
    await salesRateLimiter(ctxSales.req, ctxSales.res, ctxSales.next);
    assert(ctxSales.getStatus() === 503, 'salesRateLimiter responde HTTP 503 (fail-closed financeiro)');

    const ctxAdmin = createMockContext('10.0.0.3', { uid: 'u3', tenantId: tenantTest });
    await adminRateLimiter(ctxAdmin.req, ctxAdmin.res, ctxAdmin.next);
    assert(ctxAdmin.getStatus() === 503, 'adminRateLimiter responde HTTP 503 (fail-closed administrativo)');
  }

  // ============================================================================
  // REQUISITO 4: PostgreSQL indisponível → NÃO permite bypass do rate limit
  // ============================================================================
  console.log('\n--- [REQUISITO 4] PostgreSQL indisponível → NÃO permite bypass do rate limit ---');
  {
    const ctx = createMockContext('10.0.0.4', { uid: 'attacker', tenantId: tenantTest });
    await authRateLimiter(ctx.req, ctx.res, ctx.next);

    assert(
      !ctx.isNextCalled(),
      'Controle Fail-Closed NÃO chama next(), bloqueando estritamente a execução',
      `nextCalled: ${ctx.isNextCalled()}`
    );
  }

  // ============================================================================
  // REQUISITO 5: PostgreSQL indisponível → checkBlocked não retorna falso silenciosamente
  // ============================================================================
  console.log('\n--- [REQUISITO 5] PostgreSQL indisponível → checkBlocked não retorna falso silenciosamente ---');
  {
    const checkOutage = await SupervisorPinProtection.checkBlocked(tenantTest, 'any-user', '10.0.0.5');

    assert(
      checkOutage.isUnavailable === true,
      'SupervisorPinProtection.checkBlocked sinaliza isUnavailable=true em falha do banco',
      `checkOutage: ${JSON.stringify(checkOutage)}`
    );

    assert(
      checkOutage.isBlocked === false && checkOutage.isUnavailable === true,
      'Falha de infraestrutura NÃO é interpretada como "acesso livre/não bloqueado"'
    );
  }

  // ============================================================================
  // REQUISITO 6: PostgreSQL indisponível → falha de persistência do PIN é tratada
  // ============================================================================
  console.log('\n--- [REQUISITO 6] PostgreSQL indisponível → falha de persistência do PIN é tratada ---');
  {
    // Falha em recordFailure
    const failRecordOutage = await SupervisorPinProtection.recordFailure(tenantTest, 'any-user', '10.0.0.6');
    assert(
      failRecordOutage.isUnavailable === true,
      'recordFailure() retorna isUnavailable=true e não prossegue silenciosamente',
      `failRecordOutage: ${JSON.stringify(failRecordOutage)}`
    );

    // Falha em resetFailures
    let resetThrew = false;
    try {
      await SupervisorPinProtection.resetFailures(tenantTest, 'any-user', '10.0.0.6');
    } catch (err: any) {
      resetThrew = true;
      assert(
        err.name === 'SecurityInfrastructureError',
        'resetFailures() lança SecurityInfrastructureError quando banco está indisponível'
      );
    }
    assert(resetThrew, 'resetFailures() falha explicitamente em caso de erro no banco (sem falso sucesso)');

    // Validação integrada em PosRepository.verifySupervisorPin
    const verifyResult = await PosRepository.verifySupervisorPin({
      tenantId: tenantTest,
      pin: '1234',
      operatorId: 'op-test',
      operatorName: 'Operador Teste',
      ipAddress: '10.0.0.6'
    });

    assert(
      verifyResult.authorized === false && (verifyResult as any).statusCode === 503,
      'PosRepository.verifySupervisorPin retorna status 503 fail-closed com banco indisponível',
      `verifyResult: ${JSON.stringify(verifyResult)}`
    );
    assert(
      verifyResult.error === 'Serviço de segurança temporariamente indisponível. Tente novamente.',
      'Mensagem segura retornada pelo PosRepository sem vazamento de detalhes técnicos'
    );
  }

  // ============================================================================
  // REQUISITO 7: PostgreSQL volta → proteção funciona normalmente
  // ============================================================================
  console.log('\n--- [REQUISITO 7] PostgreSQL volta → proteção funciona normalmente ---');
  {
    // Restaura conexão real com PostgreSQL
    restoreDb();

    // Limpa buckets de teste
    await db.execute(sql`DELETE FROM rate_limit_buckets WHERE key LIKE '%recovery-test%';`);

    const ctxRecovery = createMockContext('10.0.0.7', { uid: 'recovery-test', tenantId: tenantTest });
    await authRateLimiter(ctxRecovery.req, ctxRecovery.res, ctxRecovery.next);

    assert(
      ctxRecovery.isNextCalled() && ctxRecovery.getStatus() === 200,
      'Após restauração do PostgreSQL, authRateLimiter volta a operar perfeitamente',
      `status: ${ctxRecovery.getStatus()}, nextCalled: ${ctxRecovery.isNextCalled()}`
    );

    // Supervisor PIN após retorno
    const checkRecovered = await SupervisorPinProtection.checkBlocked(tenantTest, 'recovery-test', '10.0.0.7');
    assert(
      !checkRecovered.isBlocked && !checkRecovered.isUnavailable,
      'SupervisorPinProtection.checkBlocked volta a consultar o banco real sem erro'
    );
  }

  // ============================================================================
  // REQUISITO 8: Concorrência continua funcionando
  // ============================================================================
  console.log('\n--- [REQUISITO 8] Concorrência continua funcionando ---');
  {
    const concKey = `${tenantTest}:user:fc-concurrency-test`;
    await db.execute(sql`DELETE FROM rate_limit_buckets WHERE key = ${concKey};`);

    // Dispara 10 requisições simultâneas
    const promises = Array.from({ length: 10 }, () =>
      atomicIncrementRateLimit({ key: concKey, scope: 'conc_fc', windowMs: 60000 })
    );

    const results = await Promise.all(promises);
    const sortedAttempts = results.map(r => r.attempts).sort((a, b) => a - b);

    assert(
      sortedAttempts[9] === 10,
      'Contador sob alta concorrência atingiu exatamente 10 sem lost updates',
      `Tentativas ordenadas: ${JSON.stringify(sortedAttempts)}`
    );

    const uniqueAttempts = new Set(sortedAttempts);
    assert(
      uniqueAttempts.size === 10,
      'Todas as 10 requisições concorrentes receberam contadores atômicos únicos de 1 a 10'
    );
  }

  // ============================================================================
  // REQUISITO 9: Rate limit distribuído continua funcionando entre conexões
  // ============================================================================
  console.log('\n--- [REQUISITO 9] Rate limit distribuído continua funcionando entre conexões ---');
  {
    const isolatedPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 2,
      connectionTimeoutMillis: 10000
    });

    try {
      const distKey = `${tenantTest}:user:fc-dist-test`;
      await db.execute(sql`DELETE FROM rate_limit_buckets WHERE key = ${distKey};`);

      // Incrementa pela conexão 1 (Drizzle principal)
      await atomicIncrementRateLimit({ key: distKey, scope: 'dist_test', windowMs: 60000 });
      await atomicIncrementRateLimit({ key: distKey, scope: 'dist_test', windowMs: 60000 });

      // Lê diretamente pela nova conexão isolada (Pool independente)
      const resIsolated = await isolatedPool.query(
        `SELECT attempts, scope FROM rate_limit_buckets WHERE key = $1 AND scope = $2`,
        [distKey, 'dist_test']
      );

      assert(
        resIsolated.rows.length === 1 && Number(resIsolated.rows[0].attempts) === 2,
        'Conexão isolada alternativa enxerga atomicamente o estado compartilhado no PostgreSQL',
        `Linhas retornadas: ${JSON.stringify(resIsolated.rows)}`
      );
    } finally {
      await isolatedPool.end();
    }
  }

  // ============================================================================
  // LIMPEZA FINAL
  // ============================================================================
  await db.execute(sql`DELETE FROM rate_limit_buckets WHERE key LIKE '%fc-%';`);

  console.log('\n================================================================');
  console.log(` RESULTADO GERAL FAIL-CLOSED: ${totalPass} PASS / ${totalFail} FAIL`);
  console.log('================================================================\n');

  if (totalFail > 0) {
    process.exit(1);
  }
}

runFailClosedTests().catch((err) => {
  console.error('Erro fatal na execução da suíte Fail-Closed:', err);
  process.exit(1);
});
