import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { users, auditLogs, stores } from '../db/schema.ts';
import { eq, and } from 'drizzle-orm';

export interface AuthenticatedUser {
  id: number;
  uid: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ADMINISTRADOR' | 'GERENTE' | 'FINANCEIRO' | 'ESTOQUISTA' | 'CAIXA' | 'OPERADOR';
  tenantId: string;
  storeId?: string | null;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
  [key: string]: any;
}

export interface UserResolutionResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  user?: AuthenticatedUser;
}

/**
 * Resolução e validação unificada de identidade entre Firebase Admin e PostgreSQL.
 * Compartilhada estritamente entre a API HTTP (requireAuth) e conexões WebSocket (Socket.IO).
 * Fluxo: Firebase ID Token -> verifyIdToken() -> UID -> PostgreSQL users.uid -> usuário ativo -> tenant -> store -> role.
 */
export async function resolveFirebaseIdentity(
  decodedToken: { uid: string; email?: string; email_verified?: boolean },
  ipAddress?: string
): Promise<UserResolutionResult> {
  const uid = decodedToken.uid;
  const email = decodedToken.email;

  // 1. Busca do usuário correspondente no PostgreSQL por UID
  let dbUsers = await db.select().from(users).where(eq(users.uid, uid));

  // 2. Fallback seguro: vinculação por e-mail corporativo cadastrado somente se email_verified === true
  if (dbUsers.length === 0 && email) {
    if (decodedToken.email_verified !== true) {
      return {
        success: false,
        statusCode: 401,
        error: 'E-mail não verificado. A vinculação de conta corporativa exige e-mail estritamente verificado no Firebase.'
      };
    }

    const usersByEmail = await db.select().from(users).where(eq(users.email, email));
    if (usersByEmail.length > 0) {
      const targetUser = usersByEmail[0];
      // Proteção contra Account Takeover: se já possui outro UID vinculado diferente do padrão seed
      if (targetUser.uid && targetUser.uid !== uid && !targetUser.uid.startsWith('user-')) {
        return {
          success: false,
          statusCode: 403,
          error: 'Acesso proibido: Esta conta já está vinculada a outra identidade segura.'
        };
      }

      // Atualiza o UID do usuário no PostgreSQL com o UID real verificado do Firebase Auth
      await db.update(users)
        .set({ uid, updatedAt: new Date() })
        .where(eq(users.id, targetUser.id));

      // Registro de Auditoria da vinculação de identidade
      await db.insert(auditLogs).values({
        tenantId: targetUser.tenantId,
        storeId: targetUser.storeId || null,
        userId: uid,
        userName: targetUser.name,
        action: 'VINCULACAO_FIREBASE_UID',
        entity: 'users',
        entityId: String(targetUser.id),
        newValues: { uid, email, previousUid: targetUser.uid },
        ipAddress: ipAddress || 'internal'
      });

      dbUsers = [{ ...targetUser, uid }];
    }
  }

  // 3. Usuário inexistente no banco corporativo
  if (dbUsers.length === 0) {
    return {
      success: false,
      statusCode: 403,
      error: 'Acesso proibido: Usuário não cadastrado no banco corporativo deste tenant.'
    };
  }

  const userRecord = dbUsers[0];

  // 4. Usuário desativado pelo administrador
  if (!userRecord.active) {
    return {
      success: false,
      statusCode: 403,
      error: 'Acesso proibido: Esta conta de usuário foi desativada pelo administrador.'
    };
  }

  // 5. Contexto corporativo estrito atrelado ao usuário verificado no banco
  return {
    success: true,
    user: {
      id: userRecord.id,
      uid: userRecord.uid,
      email: userRecord.email,
      name: userRecord.name,
      role: userRecord.role as AuthenticatedUser['role'],
      tenantId: userRecord.tenantId,
      storeId: userRecord.storeId
    }
  };
}

/**
 * Middleware obrigatório de autenticação de Produção via Firebase Authentication.
 * Extrai o Bearer Token, valida no Firebase Admin e sincroniza com o usuário no PostgreSQL.
 * Elimina completamente qualquer header bypass (x-operator-*, x-tenant-id, etc.).
 * NÃO contém nenhuma lógica ou bypass de teste.
 */
export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // Headers forjados e parâmetros de teste são expressamente eliminados sem exceção
  delete req.headers['x-operator-id'];
  delete req.headers['x-operator-name'];
  delete req.headers['x-operator-role'];
  delete req.headers['x-tenant-id'];
  delete req.headers['x-store-id'];
  delete req.headers['x-test-auth'];
  delete req.headers['x-test-user'];
  delete req.headers['x-user-id'];

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      sucesso: false, 
      erro: 'Não autorizado. Token de autenticação Bearer obrigatório ausente.' 
    });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();

  if (!token) {
    return res.status(401).json({ 
      sucesso: false, 
      erro: 'Token de autenticação vazio ou malformado.' 
    });
  }

  // Tokens de teste são expressamente proibidos e terminantemente rejeitados no runtime
  if (token.startsWith('test-token')) {
    return res.status(401).json({
      sucesso: false,
      erro: 'Token de autenticação inválido ou rejeitado pelo servidor de segurança.'
    });
  }

  try {
    // 1. Verificação oficial do Firebase ID Token via Admin SDK (única autoridade)
    const decodedToken = await adminAuth.verifyIdToken(token);

    // 2. Resolução estrita da identidade no PostgreSQL e verificação de status ativo
    const resolution = await resolveFirebaseIdentity(decodedToken, req.ip);

    if (!resolution.success) {
      return res.status(resolution.statusCode || 401).json({
        sucesso: false,
        erro: resolution.error
      });
    }

    req.user = resolution.user!;
    next();
  } catch (error: any) {
    const isExpired = error?.code === 'auth/id-token-expired' || error?.message?.includes('expired');
    return res.status(401).json({ 
      sucesso: false, 
      erro: isExpired 
        ? 'Sessão expirada. Faça login novamente para renovar o token de segurança.' 
        : 'Token de autenticação inválido ou rejeitado pelo servidor de segurança.' 
    });
  }
};

/**
 * Middleware RBAC: Valida se o papel (role) do usuário atende aos requisitos
 */
export const requireRole = (allowedRoles: Array<AuthenticatedUser['role']>) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ sucesso: false, erro: 'Usuário não autenticado.' });
    }

    // SUPER_ADMIN possui permissão global irrestrita
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      // Log de auditoria sobre tentativa de violação de RBAC
      db.insert(auditLogs).values({
        tenantId: req.user.tenantId,
        storeId: req.user.storeId || null,
        userId: req.user.uid,
        userName: req.user.name,
        action: 'ACESSO_NEGADO_RBAC',
        entity: 'routes',
        entityId: req.originalUrl,
        newValues: { requiredRoles: allowedRoles, userRole: req.user.role },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string
      }).catch(console.error);

      return res.status(403).json({
        sucesso: false,
        erro: `Acesso negado: Perfil '${req.user.role}' não possui permissão para executar esta ação.`
      });
    }

    next();
  };
};

/**
 * Validação centralizada e estrita de acesso à unidade (storeId) e isolamento multi-tenant (tenantId).
 *
 * Opera estritamente em MODO FAIL-CLOSED:
 * - Se qualquer parâmetro for nulo, indefinido, vazio ou inválido: NEGAR acesso imediatamente (HTTP 403).
 * - O usuário deve possuir tenantId autenticado e válido.
 * - Para papéis operacionais (GERENTE, CAIXA, OPERADOR, ESTOQUISTA, FINANCEIRO):
 *   É estritamente obrigatório possuir storeId vinculado ao usuário, e este storeId deve corresponder
 *   exatamente à unidade requisitada. Ausência de storeId ou mismatch resulta em negação imediata (HTTP 403).
 * - Para qualquer perfil (inclusive ADMINISTRADOR e SUPER_ADMIN):
 *   Se o usuário possuir storeId vinculado, este deve obrigatoriamente coincidir com a unidade requisitada.
 * - Em todos os casos, a unidade requisitada DEVE existir no banco de dados e pertencer ESTRITAMENTE
 *   ao tenantId autorizado do usuário (stores.storeId = storeId AND stores.tenantId = user.tenantId).
 * - NENHUM fallback para buscas globais: NUNCA executar consultas na tabela de lojas sem o filtro
 *   obrigatório de tenantId.
 * - Retorno HTTP 403 para qualquer tentativa de violação de escopo ou inconsistência.
 */
export const validateStoreAccess = async (
  user: AuthenticatedUser,
  storeId?: string | null,
  _options?: unknown
): Promise<{ allowed: boolean; store?: any; error?: string; statusCode: number }> => {
  try {
    // 0. Fail-closed se o usuário for inválido ou ausente
    if (!user || typeof user !== 'object') {
      return {
        allowed: false,
        statusCode: 403,
        error: 'Acesso negado: Credencial de usuário não identificada.'
      };
    }

    if (!user.uid || typeof user.uid !== 'string' || user.uid.trim() === '') {
      return {
        allowed: false,
        statusCode: 403,
        error: 'Acesso negado: Identificador de usuário (uid) inválido ou ausente.'
      };
    }

    if (!user.role || typeof user.role !== 'string' || user.role.trim() === '') {
      return {
        allowed: false,
        statusCode: 403,
        error: 'Acesso negado: Perfil de acesso não definido para o usuário.'
      };
    }

    // TenantId é estritamente obrigatório em todas as operações
    if (!user.tenantId || typeof user.tenantId !== 'string' || user.tenantId.trim() === '') {
      return {
        allowed: false,
        statusCode: 403,
        error: 'Acesso negado: Contexto de organização (tenantId) não identificado para o usuário.'
      };
    }

    // Se storeId não informado ou em branco: FAIL-CLOSED imediato
    if (!storeId || typeof storeId !== 'string' || storeId.trim() === '') {
      return {
        allowed: false,
        statusCode: 403,
        error: 'Acesso negado: Identificador da unidade (storeId) é obrigatório e não foi informado.'
      };
    }

    const cleanStoreId = storeId.trim();
    const cleanTenantId = user.tenantId.trim();

    // 1. Verificação de papéis e correspondência estrita de storeId
    const OPERATIONAL_ROLES = ['GERENTE', 'CAIXA', 'OPERADOR', 'ESTOQUISTA', 'FINANCEIRO'];
    const isOperationalRole = OPERATIONAL_ROLES.includes(user.role);

    if (isOperationalRole) {
      // Usuário operacional sem storeId vinculado: FAIL-CLOSED imediato
      if (!user.storeId || typeof user.storeId !== 'string' || user.storeId.trim() === '') {
        return {
          allowed: false,
          statusCode: 403,
          error: `Acesso negado: Usuário operacional com perfil '${user.role}' não possui unidade vinculada.`
        };
      }

      // Tentativa de acessar unidade diferente daquela vinculada ao usuário: FAIL-CLOSED imediato
      if (user.storeId.trim() !== cleanStoreId) {
        return {
          allowed: false,
          statusCode: 403,
          error: `Acesso negado: Seu usuário está vinculado à unidade '${user.storeId}' e não pode acessar a unidade '${cleanStoreId}'.`
        };
      }
    } else if (user.role === 'ADMINISTRADOR' || user.role === 'SUPER_ADMIN') {
      // Para perfis administrativos, se houver storeId explicitamente atribuída ao usuário, ela deve coincidir com a requisitada
      if (user.storeId && typeof user.storeId === 'string' && user.storeId.trim() !== '') {
        if (user.storeId.trim() !== cleanStoreId) {
          return {
            allowed: false,
            statusCode: 403,
            error: `Acesso negado: Seu usuário está vinculado à unidade '${user.storeId}' e não pode acessar a unidade '${cleanStoreId}'.`
          };
        }
      }
    } else {
      // Perfil desconhecido ou não homologado: FAIL-CLOSED imediato
      return {
        allowed: false,
        statusCode: 403,
        error: `Acesso negado: Perfil '${user.role}' não possui permissão para acessar unidades.`
      };
    }

    // 2. Consulta estritamente delimitada ao tenantId autorizado do usuário autenticado.
    // NUNCA executar consultas globais sem tenantId! Sem fallback global.
    const storeRows = await db.select().from(stores).where(
      and(
        eq(stores.storeId, cleanStoreId),
        eq(stores.tenantId, cleanTenantId)
      )
    );

    if (storeRows.length === 0) {
      return {
        allowed: false,
        statusCode: 403,
        error: `Acesso negado: A unidade '${cleanStoreId}' não pertence ao tenant atual ('${cleanTenantId}') ou não existe (Tenant mismatch).`
      };
    }

    const storeRecord = storeRows[0];

    if (storeRecord.active === false) {
      return {
        allowed: false,
        statusCode: 403,
        error: `Acesso negado: A unidade '${cleanStoreId}' está desativada no sistema.`
      };
    }

    return {
      allowed: true,
      store: storeRecord,
      statusCode: 200
    };
  } catch (err: any) {
    // Modo Fail-Closed: Qualquer erro inesperado resulta em negação de acesso imediata
    return {
      allowed: false,
      statusCode: 403,
      error: 'Acesso negado: Falha interna ao validar autorização de acesso à unidade.'
    };
  }
};
