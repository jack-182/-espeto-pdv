import express, { Request, Response } from 'express';
import { handleTestAuth } from './testAuth.ts';
import { requireRole, validateStoreAccess, AuthRequest } from '../../middleware/auth.ts';
import { 
  validateBody, 
  vendaSchema, 
  aberturaTurnoSchema, 
  fechamentoCaixaSchema, 
  movimentacaoCaixaSchema,
  supervisorPinSchema,
  createEmployeeSchema,
  updateEmployeeStatusSchema,
  updateEmployeeStoreSchema,
  acceptInvitationSchema
} from '../../middleware/validation.ts';
import { PosRepository } from '../../db/repository.ts';
import { db } from '../../db/index.ts';
import { users } from '../../db/schema.ts';
import { eq } from 'drizzle-orm';
import { generateRequestFingerprint, IdempotencyConflictError } from '../../lib/idempotency.ts';

/**
 * Servidor Express Exclusivo para Execução de Testes Automatizados (Fixtures)
 * Não é importado pelo runtime de produção (server.ts).
 */
export function createSecurityTestApp() {
  const app = express();
  app.use(express.json());

  // Rota de lojas do tenant
  app.get('/api/lojas', handleTestAuth, async (req: AuthRequest, res: Response) => {
    try {
      const list = await PosRepository.getStores(req.user!.tenantId);
      res.json({ sucesso: true, data: list, lojas: list });
    } catch (err: any) {
      res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // Rota de loja individual com validação de tenant
  app.get('/api/lojas/:lojaId', handleTestAuth, async (req: AuthRequest, res: Response) => {
    const { lojaId } = req.params;
    try {
      const access = await validateStoreAccess(req.user!, lojaId);
      if (!access.allowed) {
        return res.status(403).json({ sucesso: false, erro: access.error });
      }
      res.json({ sucesso: true, loja: access.store });
    } catch (err: any) {
      res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // Rota de produtos da loja com isolamento
  app.get('/api/lojas/:lojaId/produtos', handleTestAuth, async (req: AuthRequest, res: Response) => {
    const { lojaId } = req.params;
    try {
      const access = await validateStoreAccess(req.user!, lojaId);
      if (!access.allowed) {
        return res.status(403).json({ sucesso: false, erro: access.error });
      }
      const lista = await PosRepository.getProductsByStore(lojaId, req.user!.tenantId);
      res.json({ sucesso: true, produtos: lista });
    } catch (err: any) {
      res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // Rota administrativa protegida por RBAC
  app.get('/api/v1/auth/users', handleTestAuth, requireRole(['ADMINISTRADOR', 'SUPER_ADMIN']), async (req: AuthRequest, res: Response) => {
    try {
      const list = await db.select().from(users).where(eq(users.tenantId, req.user!.tenantId));
      res.json({ sucesso: true, users: list });
    } catch (err: any) {
      res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // GESTÃO DE FUNCIONÁRIOS OPERADOR E CONVITES (TEST APP)
  app.get('/api/v1/employees', handleTestAuth, requireRole(['ADMINISTRADOR', 'SUPER_ADMIN']), async (req: AuthRequest, res: Response) => {
    try {
      const employees = await PosRepository.getEmployees(req.user!.tenantId);
      res.json({ sucesso: true, data: employees });
    } catch (error: any) {
      res.status(500).json({ sucesso: false, erro: error.message });
    }
  });

  app.post(
    '/api/v1/employees',
    handleTestAuth,
    requireRole(['ADMINISTRADOR', 'SUPER_ADMIN']),
    validateBody(createEmployeeSchema),
    async (req: AuthRequest, res: Response) => {
      try {
        if (req.body.role && req.body.role !== 'OPERADOR') {
          return res.status(400).json({
            sucesso: false,
            erro: 'Violação de segurança: Este fluxo permite exclusivamente o cadastro de funcionários com perfil OPERADOR.'
          });
        }

        const { nome, email, lojaId, status } = req.body;
        const novoFuncionario = await PosRepository.createOperatorEmployee({
          tenantId: req.user!.tenantId,
          storeId: lojaId,
          name: nome,
          email: email,
          status: status || 'ACTIVE',
          createdByUserId: req.user!.uid,
          createdByUserName: req.user!.name,
          ipAddress: '127.0.0.1',
          appUrl: 'http://localhost:3000'
        });

        res.status(201).json({
          sucesso: true,
          mensagem: 'Funcionário cadastrado com sucesso. Convite de acesso gerado.',
          data: novoFuncionario
        });
      } catch (error: any) {
        const isConflict = error.message.includes('Já existe um funcionário');
        const isInvalidStore = error.message.includes('loja informada não existe');
        const status = isConflict ? 409 : isInvalidStore ? 400 : 500;
        res.status(status).json({ sucesso: false, erro: error.message });
      }
    }
  );

  app.patch(
    '/api/v1/employees/:id/status',
    handleTestAuth,
    requireRole(['ADMINISTRADOR', 'SUPER_ADMIN']),
    validateBody(updateEmployeeStatusSchema),
    async (req: AuthRequest, res: Response) => {
      try {
        const { id } = req.params;
        const { status } = req.body;

        const resultado = await PosRepository.updateEmployeeStatus({
          tenantId: req.user!.tenantId,
          employeeId: id,
          status,
          updatedByUserId: req.user!.uid,
          updatedByUserName: req.user!.name,
          ipAddress: '127.0.0.1'
        });

        res.json({
          sucesso: true,
          mensagem: `Funcionário ${status === 'ACTIVE' ? 'ativado' : 'desativado'} com sucesso.`,
          data: resultado
        });
      } catch (error: any) {
        const isNotFound = error.message.includes('não encontrado');
        const isForbidden = error.message.includes('Apenas funcionários com perfil OPERADOR');
        const status = isNotFound ? 404 : isForbidden ? 403 : 500;
        res.status(status).json({ sucesso: false, erro: error.message });
      }
    }
  );

  app.patch(
    '/api/v1/employees/:id/store',
    handleTestAuth,
    requireRole(['ADMINISTRADOR', 'SUPER_ADMIN']),
    validateBody(updateEmployeeStoreSchema),
    async (req: AuthRequest, res: Response) => {
      try {
        const { id } = req.params;
        const { lojaId } = req.body;

        const resultado = await PosRepository.updateEmployeeStore({
          tenantId: req.user!.tenantId,
          employeeId: id,
          storeId: lojaId,
          updatedByUserId: req.user!.uid,
          updatedByUserName: req.user!.name,
          ipAddress: '127.0.0.1'
        });

        res.json({
          sucesso: true,
          mensagem: 'Loja vinculada ao funcionário com sucesso.',
          data: resultado
        });
      } catch (error: any) {
        const isNotFound = error.message.includes('não encontrado');
        const isInvalidStore = error.message.includes('loja informada não existe');
        const isForbidden = error.message.includes('Apenas funcionários com perfil OPERADOR');
        const status = isNotFound ? 404 : (isInvalidStore || isForbidden) ? 400 : 500;
        res.status(status).json({ sucesso: false, erro: error.message });
      }
    }
  );

  app.post(
    '/api/v1/employees/:id/resend-invite',
    handleTestAuth,
    requireRole(['ADMINISTRADOR', 'SUPER_ADMIN']),
    async (req: AuthRequest, res: Response) => {
      try {
        const { id } = req.params;
        const resultado = await PosRepository.resendEmployeeInvitation({
          tenantId: req.user!.tenantId,
          employeeId: id,
          createdByUserId: req.user!.uid,
          createdByUserName: req.user!.name,
          ipAddress: '127.0.0.1',
          appUrl: 'http://localhost:3000'
        });

        res.json({ sucesso: true, data: resultado });
      } catch (error: any) {
        res.status(error.message.includes('não encontrado') ? 404 : 500).json({ sucesso: false, erro: error.message });
      }
    }
  );

  app.get('/api/v1/invitations/:token', async (req: Request, res: Response) => {
    try {
      const convite = await PosRepository.getInvitationByToken(req.params.token);
      if (!convite) {
        return res.status(404).json({ sucesso: false, erro: 'Convite não encontrado ou token inválido.' });
      }
      res.json({ sucesso: true, data: convite });
    } catch (error: any) {
      res.status(500).json({ sucesso: false, erro: error.message });
    }
  });

  app.post(
    '/api/v1/invitations/:token/accept',
    validateBody(acceptInvitationSchema),
    async (req: Request, res: Response) => {
      try {
        const { token } = req.params;
        const { pin, name } = req.body;
        const resultado = await PosRepository.acceptEmployeeInvitation(token, pin, name);
        res.json({ sucesso: true, data: resultado });
      } catch (error: any) {
        const isClient = error.message.includes('inválido') || error.message.includes('expirou') || error.message.includes('anteriormente');
        res.status(isClient ? 400 : 500).json({ sucesso: false, erro: error.message });
      }
    }
  );

  // Validação Segura de PIN de Supervisor (Administrador / Gerente)
  app.post(
    '/api/v1/auth/verify-supervisor-pin',
    handleTestAuth,
    validateBody(supervisorPinSchema),
    async (req: AuthRequest, res: Response) => {
      const { pin, storeId: requestedStoreId } = req.body;
      try {
        const user = req.user!;
        if (!user || !user.tenantId) {
          return res.status(403).json({ sucesso: false, erro: 'Autorização não permitida.' });
        }

        const effectiveStoreId = requestedStoreId || user.storeId;
        if (!effectiveStoreId) {
          return res.status(403).json({ sucesso: false, erro: 'Autorização não permitida.' });
        }

        const access = await validateStoreAccess(user, effectiveStoreId);
        if (!access.allowed) {
          return res.status(403).json({ sucesso: false, erro: 'Autorização não permitida.' });
        }

        const result = await PosRepository.verifySupervisorPin({
          tenantId: user.tenantId,
          pin,
          storeId: effectiveStoreId,
          operatorId: user.uid,
          operatorName: user.name,
          ipAddress: req.ip
        });

        if (!result.authorized) {
          return res.status(403).json({ sucesso: false, erro: 'Autorização não permitida.' });
        }

        res.json({ sucesso: true, supervisor: result.supervisor });
      } catch (error: any) {
        res.status(503).json({ sucesso: false, erro: 'Serviço de segurança temporariamente indisponível.' });
      }
    }
  );

  // Rota de vendas com RBAC, isolamento de loja, idempotência e concorrência de estoque
  app.post(
    '/api/vendas',
    handleTestAuth,
    requireRole(['SUPER_ADMIN', 'ADMINISTRADOR', 'GERENTE', 'CAIXA', 'OPERADOR']),
    validateBody(vendaSchema),
    async (req: AuthRequest, res: Response) => {
      const { lojaId: frontendLojaId, formaPagamento, valor, itens, descontoSolicitado, simulateFailureAfterStock } = req.body;
      const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

      try {
        const user = req.user!;

        // Isolamento de loja: perfis operacionais usam estritamente o storeId vinculado
        let effectiveStoreId: string;
        if (user.role === 'ADMINISTRADOR' || user.role === 'SUPER_ADMIN') {
          effectiveStoreId = frontendLojaId || user.storeId || '';
        } else {
          if (!user.storeId) {
            return res.status(403).json({
              sucesso: false,
              erro: `Acesso negado: Usuário operacional com perfil '${user.role}' não possui unidade vinculada.`
            });
          }
          if (frontendLojaId && frontendLojaId !== user.storeId) {
            return res.status(403).json({
              sucesso: false,
              erro: `Acesso negado: Seu usuário está vinculado à unidade '${user.storeId}' e não pode operar a unidade '${frontendLojaId}'.`
            });
          }
          effectiveStoreId = user.storeId;
        }

        const access = await validateStoreAccess(user, effectiveStoreId);
        if (!access.allowed) {
          return res.status(access.statusCode || 403).json({ sucesso: false, erro: access.error });
        }

        const fingerprint = idempotencyKey
          ? generateRequestFingerprint({
              tenantId: user.tenantId,
              storeId: effectiveStoreId,
              endpoint: 'POST /api/vendas',
              payload: req.body
            })
          : undefined;

        const result = await PosRepository.processQuickSale({
          tenantId: user.tenantId,
          storeId: effectiveStoreId,
          items: itens,
          paymentMethod: formaPagamento,
          total: valor !== undefined ? Number(valor) : undefined,
          discountRequested: descontoSolicitado !== undefined ? Number(descontoSolicitado) : undefined,
          operatorId: user.uid,
          operatorName: user.name,
          idempotencyKey,
          fingerprint,
          requestPath: 'POST /api/vendas',
          ipAddress: req.ip,
          simulateFailureAfterStock: Boolean(simulateFailureAfterStock && process.env.NODE_ENV !== 'production')
        });

        if (result.isIdempotentReplay) {
          return res.status(200).json(result.data);
        }

        res.status(201).json(result.data);
      } catch (error: any) {
        if (error instanceof IdempotencyConflictError || error?.statusCode === 409) {
          return res.status(409).json({
            sucesso: false,
            erro: error.message || 'Idempotency-Key já utilizada para uma requisição diferente.'
          });
        }
        if (error.message?.includes('SIMULATED_TRANSACTION_FAILURE')) {
          return res.status(500).json({ sucesso: false, erro: error.message });
        }
        res.status(400).json({ sucesso: false, erro: error.message });
      }
    }
  );

  // Turno atual
  app.get('/api/lojas/:lojaId/turnos/atual', handleTestAuth, async (req: AuthRequest, res: Response) => {
    const { lojaId } = req.params;
    try {
      const access = await validateStoreAccess(req.user!, lojaId);
      if (!access.allowed) {
        return res.status(403).json({ sucesso: false, erro: access.error });
      }
      const current = await PosRepository.getCurrentCashSession(lojaId, req.user!.tenantId);
      if (!current) {
        return res.json({ sucesso: true, turnoAberto: false, data: null });
      }
      res.json({
        sucesso: true,
        turnoAberto: true,
        turno: current,
        data: {
          ...current.session,
          id: current.session.sessionId,
        }
      });
    } catch (err: any) {
      res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

  // Abertura de turno
  app.post('/api/lojas/:lojaId/turnos/abrir', handleTestAuth, validateBody(aberturaTurnoSchema), async (req: AuthRequest, res: Response) => {
    const { lojaId } = req.params;
    const { fundoTrocoInicial } = req.body;

    try {
      const access = await validateStoreAccess(req.user!, lojaId);
      if (!access.allowed) {
        return res.status(403).json({ sucesso: false, erro: access.error });
      }

      const novoTurno = await PosRepository.openCashSession({
        tenantId: req.user!.tenantId,
        storeId: lojaId,
        operatorId: req.user!.uid,
        operatorName: req.user!.name,
        initialFund: Number(fundoTrocoInicial),
        ipAddress: req.ip
      });

      res.status(201).json({ 
        sucesso: true, 
        mensagem: 'Turno de caixa aberto com sucesso no PostgreSQL.', 
        data: novoTurno 
      });
    } catch (error: any) {
      res.status(400).json({ sucesso: false, erro: error.message });
    }
  });

  // Fechamento de caixa
  app.post('/api/fechamento/:lojaId', handleTestAuth, validateBody(fechamentoCaixaSchema), async (req: AuthRequest, res: Response) => {
    const { lojaId } = req.params;
    const { dinheiroInformadoNaGaveta, pixInformado, cartaoInformado, observacoes } = req.body;

    try {
      const access = await validateStoreAccess(req.user!, lojaId);
      if (!access.allowed) {
        return res.status(403).json({ sucesso: false, erro: access.error });
      }

      const current = await PosRepository.getCurrentCashSession(lojaId, req.user!.tenantId);
      if (!current) {
        return res.status(404).json({ sucesso: false, erro: 'Nenhum turno de caixa aberto encontrado nesta unidade.' });
      }

      const closed = await PosRepository.closeCashSession({
        tenantId: req.user!.tenantId,
        storeId: lojaId,
        sessionId: current.session.sessionId,
        operatorId: req.user!.uid,
        operatorName: req.user!.name,
        declaredCash: Number(dinheiroInformadoNaGaveta),
        declaredPix: pixInformado ? Number(pixInformado) : 0,
        declaredCard: cartaoInformado ? Number(cartaoInformado) : 0,
        notes: observacoes,
        ipAddress: req.ip
      });

      res.json({
        sucesso: true,
        lojaId,
        operador: closed.operatorName,
        totalSistemaDinheiro: Number(closed.systemCash),
        dinheiroInformadoNaGaveta: Number(closed.declaredCash),
        diferencaQuebra: Number(closed.cashDifference),
        statusExpediente: 'Encerrado com Sucesso no Banco de Dados'
      });
    } catch (error: any) {
      res.status(400).json({ sucesso: false, erro: error.message });
    }
  });

  // Movimentação de caixa / Sangria
  app.post('/api/lojas/:lojaId/turnos/:turnoId/movimentacoes', handleTestAuth, validateBody(movimentacaoCaixaSchema), async (req: AuthRequest, res: Response) => {
    const { lojaId, turnoId } = req.params;
    const { tipo, valor, motivo } = req.body;

    try {
      const access = await validateStoreAccess(req.user!, lojaId);
      if (!access.allowed) {
        return res.status(403).json({ sucesso: false, erro: access.error });
      }

      const { mov } = await PosRepository.addCashMovement({
        tenantId: req.user!.tenantId,
        storeId: lojaId,
        sessionId: turnoId,
        type: tipo as 'SANGRIA' | 'SUPRIMENTO',
        amount: Number(valor),
        reason: motivo,
        operatorId: req.user!.uid,
        operatorName: req.user!.name,
        ipAddress: req.ip
      });

      res.status(201).json({ 
        sucesso: true, 
        mensagem: `${tipo} registrada com sucesso no banco de dados.`, 
        data: mov 
      });
    } catch (error: any) {
      res.status(400).json({ sucesso: false, erro: error.message });
    }
  });

  return app;
}
