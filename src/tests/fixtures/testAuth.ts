import { Response, NextFunction } from 'express';
import { db } from '../../db/index.ts';
import { users } from '../../db/schema.ts';
import { eq } from 'drizzle-orm';
import { AuthRequest, AuthenticatedUser } from '../../middleware/auth.ts';

/**
 * FIXTURE EXCLUSIVA PARA SUÍTES DE TESTES AUTOMATIZADOS (tests/fixtures)
 * 
 * Este arquivo é estritamente isolado do runtime de produção.
 * O runtime de produção (server.ts / src/middleware/auth.ts) NÃO importa este arquivo.
 */

export const isTestAuthAllowed = (): boolean => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isEnabled = process.env.ENABLE_TEST_AUTH === 'true';
  if (isProduction) return false;
  return isEnabled;
};

export interface TestAuthResult {
  allowed: boolean;
  uid?: string;
  error?: string;
  statusCode?: number;
}

export const processTestToken = (token: string): TestAuthResult => {
  if (!isTestAuthAllowed()) {
    return {
      allowed: false,
      statusCode: 401,
      error: 'Tokens de teste são terminantemente proibidos em produção ou quando ENABLE_TEST_AUTH não está ativo.'
    };
  }

  // Formato do token de teste: test-token:<tipo>:<uid>
  const parts = token.split(':');
  const testType = parts[1];
  const testUid = parts[2] || 'user-admin-jackson';

  if (testType === 'invalid') {
    return {
      allowed: false,
      statusCode: 401,
      error: 'Token de autenticação inválido ou rejeitado pelo servidor de segurança.'
    };
  }

  if (testType === 'expired') {
    return {
      allowed: false,
      statusCode: 401,
      error: 'Sessão expirada. Faça login novamente para renovar o token de segurança.'
    };
  }

  return {
    allowed: true,
    uid: testUid
  };
};

/**
 * Middleware para tratamento isolado de tokens de teste em fixtures de teste
 */
export const handleTestAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // Headers forjados são estritamente removidos mesmo no fluxo de testes
  delete req.headers['x-operator-id'];
  delete req.headers['x-operator-name'];
  delete req.headers['x-operator-role'];
  delete req.headers['x-tenant-id'];
  delete req.headers['x-store-id'];
  delete req.headers['x-test-auth'];
  delete req.headers['x-test-user'];
  delete req.headers['x-user-id'];

  const authHeader = req.headers.authorization;
  const token = authHeader?.split('Bearer ')[1]?.trim() || '';

  const testResult = processTestToken(token);
  if (!testResult.allowed) {
    return res.status(testResult.statusCode || 401).json({
      sucesso: false,
      erro: testResult.error
    });
  }

  try {
    let dbUsers = await db.select().from(users).where(eq(users.uid, testResult.uid!));

    if (dbUsers.length === 0 && testResult.uid === 'user-admin-jackson') {
      dbUsers = await db.select().from(users).where(eq(users.email, 'jacksopereira.182@gmail.com'));
    }

    if (dbUsers.length === 0) {
      return res.status(403).json({
        sucesso: false,
        erro: 'Acesso proibido: Usuário de teste não cadastrado no banco corporativo.'
      });
    }

    const userRecord = dbUsers[0];

    if (!userRecord.active) {
      return res.status(403).json({
        sucesso: false,
        erro: 'Acesso proibido: Esta conta de usuário foi desativada pelo administrador.'
      });
    }

    req.user = {
      id: userRecord.id,
      uid: userRecord.uid,
      email: userRecord.email,
      name: userRecord.name,
      role: userRecord.role as AuthenticatedUser['role'],
      tenantId: userRecord.tenantId,
      storeId: userRecord.storeId
    };

    next();
  } catch (error: any) {
    return res.status(500).json({
      sucesso: false,
      erro: 'Erro interno ao processar autenticação de teste.'
    });
  }
};
