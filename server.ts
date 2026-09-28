import dotenv from 'dotenv';
dotenv.config({ override: true });
import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { PosRepository } from './src/db/repository.ts';
import { seedDatabase } from './src/db/seed.ts';
import { 
  requireAuth, 
  requireRole, 
  validateStoreAccess, 
  resolveFirebaseIdentity,
  AuthRequest 
} from './src/middleware/auth.ts';
import { 
  validateBody, 
  vendaSchema, 
  aberturaTurnoSchema, 
  movimentacaoCaixaSchema, 
  fechamentoCaixaSchema, 
  supervisorPinSchema,
  createEmployeeSchema,
  updateEmployeeStatusSchema,
  updateEmployeeStoreSchema,
  acceptInvitationSchema
} from './src/middleware/validation.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';
import { db } from './src/db/index.ts';
import { 
  users, 
  products, 
  orders, 
  orderItems, 
  cashSessions, 
  notifications 
} from './src/db/schema.ts';
import { eq, sql, and } from 'drizzle-orm';
import { 
  authRateLimiter, 
  salesRateLimiter, 
  adminRateLimiter, 
  publicRateLimiter 
} from './src/middleware/rateLimiter.ts';
import { 
  generateRequestFingerprint, 
  IdempotencyConflictError 
} from './src/lib/idempotency.ts';

const app = express();
const PORT = 3000;

// ============================================================================
// 1. CONFIGURAÇÃO DE CORS ADAPTADA AO GOOGLE AI STUDIO
// ============================================================================

const isProduction = process.env.NODE_ENV === 'production';

// Regra estrita de segurança: em produção, ENABLE_TEST_AUTH é obrigatoriamente 'false'
if (isProduction) {
  process.env.ENABLE_TEST_AUTH = 'false';
}

import { 
  sanitizeOrigin, 
  getResolvedAllowedOrigins, 
  validateCorsOrigin 
} from './src/lib/cors.ts';

export { sanitizeOrigin, getResolvedAllowedOrigins, validateCorsOrigin };

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Requisições sem header 'origin' são navegações diretas do navegador (ex: GET /, carregar index.html e static assets)
    // ou requisições same-origin. Não são requisições cross-origin (CORS).
    if (!origin) {
      return callback(null, true);
    }
    return validateCorsOrigin(origin, isProduction, callback);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key']
};

app.use(cors(corsOptions));
app.use(express.json());

// Endpoint de diagnóstico de CORS (Desabilitado com 404 estrito em produção)
app.get('/api/test-cors', (req: Request, res: Response) => {
  if (isProduction) {
    return res.status(404).json({ sucesso: false, erro: 'Endpoint não disponível em ambiente de produção.' });
  }
  res.json({ sucesso: true, origin: req.headers.origin || 'sem-origin' });
});

// Middleware de Autenticação da API HTTP
// Depende exclusivamente de requireAuth (Firebase ID Token -> Firebase Admin -> PostgreSQL -> RBAC)
// O runtime do servidor não contém nenhum caminho de teste, fixtures ou bypass de cabeçalhos
export const appAuth = requireAuth;

const server = http.createServer(app);

// ============================================================================
// 2. SOCKET.IO COM HANDSHAKE AUTENTICADO OBRIGATÓRIO (FIREBASE AUTH)
// ============================================================================

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }
      return validateCorsOrigin(origin, isProduction, callback);
    },
    credentials: true
  }
});

// Middleware de autenticação de Handshake do Socket.IO (Firebase ID Token obrigatório)
// Segue exatamente a mesma política de identidade, PostgreSQL e proteção contra Account Takeover do HTTP
io.use(async (socket, next) => {
  // Ignora cabeçalhos forjados e dados enviados pelo cliente para forjar identidade
  const token = socket.handshake.auth?.token;

  if (!token) {
    console.warn('[Socket.IO Auth] Conexão rejeitada: token ausente no handshake.');
    return next(new Error('Authentication error: Token de autenticação ausente no handshake.'));
  }

  try {
    // 1. Verificação oficial estrita via Firebase Admin SDK (rejeita nativamente qualquer token inválido ou não-Firebase)
    const decoded = await adminAuth.verifyIdToken(token);
    
    // 2. Mesma política de identidade e verificação no PostgreSQL do requireAuth
    const resolution = await resolveFirebaseIdentity(decoded, socket.handshake.address);

    if (!resolution.success) {
      return next(new Error(`Authentication error: ${resolution.error}`));
    }

    const user = resolution.user!;
    socket.data.user = user;

    // Associa o socket a salas corporativas isoladas (Tenant Room e Store Room)
    socket.join(`tenant:${user.tenantId}`);
    if (user.storeId) {
      socket.join(`store:${user.storeId}`);
    }

    next();
  } catch (err: any) {
    console.warn('[Socket.IO Auth] Falha ao verificar token:', err?.message);
    return next(new Error('Authentication error: Token inválido ou expirado.'));
  }
});

io.on('connection', (socket) => {
  const user = socket.data.user;
  console.log(`[WebSocket] Usuário autenticado conectado: ${user?.name} (${user?.role}) no tenant: ${user?.tenantId}`);

  socket.on('disconnect', () => {
    console.log(`[WebSocket] Cliente desconectado: ${socket.id}`);
  });
});

// Inicialização e Seed do Banco Relacional PostgreSQL
seedDatabase().catch(err => {
  console.error('[Database Startup] Erro ao inicializar seed:', err);
});

// ============================================================================
// 3. ROTAS PÚBLICAS & HEALTHCHECK (PROTEGIDAS POR RATE LIMIT)
// ============================================================================

app.get('/api/health', publicRateLimiter, async (_req: Request, res: Response) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({
      status: 'online',
      banco: 'PostgreSQL Relacional (Cloud SQL)',
      seguranca: 'Firebase Auth Bearer + RBAC + Zod + Idempotency + Rate Limiting',
      timestamp: new Date().toISOString(),
      servico: 'GESTÃO INTELLIGENCE OS API v1'
    });
  } catch (error: any) {
    res.json({
      status: 'degraded',
      erro: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// 4. ROTAS AUTENTICADAS E PROTEGIDAS POR TENANT & RBAC
// ============================================================================

// Perfil do Usuário Autenticado
app.get(['/api/v1/auth/me', '/api/auth/me'], authRateLimiter, appAuth, (req: AuthRequest, res: Response) => {
  res.json({
    sucesso: true,
    user: req.user
  });
});

// Validação Segura de PIN de Supervisor (Administrador / Gerente) com Rate Limiting e Detecção de Brute Force
app.post(
  '/api/v1/auth/verify-supervisor-pin',
  authRateLimiter,
  appAuth,
  validateBody(supervisorPinSchema),
  async (req: AuthRequest, res: Response) => {
    const { pin, storeId: requestedStoreId } = req.body;
    try {
      const user = req.user!;

      // 1-4. Autenticação e validação de tenant garantidas pelo appAuth
      if (!user || !user.tenantId) {
        return res.status(403).json({ sucesso: false, erro: 'Autorização não permitida.' });
      }

      // 5. Determinar e validar acesso à storeId:
      // Se informada storeId, o usuário DEVE possuir acesso autorizado a ela via validateStoreAccess.
      // Se não informada storeId no body, utiliza a storeId vinculada ao usuário.
      const effectiveStoreId = requestedStoreId || user.storeId;
      if (!effectiveStoreId) {
        return res.status(403).json({
          sucesso: false,
          erro: 'Autorização não permitida.'
        });
      }

      // Validação estrita de acesso do usuário solicitante à unidade alvo (Fail-Closed)
      const access = await validateStoreAccess(user, effectiveStoreId);
      if (!access.allowed) {
        return res.status(403).json({
          sucesso: false,
          erro: 'Autorização não permitida.'
        });
      }

      // 6-8. Verificação segura do PIN do supervisor com escopo e auditoria
      const result = await PosRepository.verifySupervisorPin({
        tenantId: user.tenantId,
        pin,
        storeId: effectiveStoreId,
        operatorId: user.uid,
        operatorName: user.name,
        ipAddress: req.ip
      });

      if (!result.authorized) {
        if ((result as any).isUnavailable || (result as any).statusCode === 503) {
          return res.status(503).json({
            sucesso: false,
            erro: 'Serviço de segurança temporariamente indisponível. Tente novamente.'
          });
        }
        if ((result as any).isRateLimited) {
          res.setHeader('Retry-After', (result as any).retryAfterSeconds || 300);
          return res.status(429).json({ 
            sucesso: false, 
            erro: result.error, 
            retryAfter: (result as any).retryAfterSeconds 
          });
        }
        return res.status(403).json({ sucesso: false, erro: 'Autorização não permitida.' });
      }

      res.json({ sucesso: true, supervisor: result.supervisor });
    } catch (error: any) {
      console.error('[verifySupervisorPin Endpoint Error]:', error);
      res.status(503).json({
        sucesso: false,
        erro: 'Serviço de segurança temporariamente indisponível. Tente novamente.'
      });
    }
  }
);

// Lojas / Estabelecimentos do Tenant Autenticado
app.get('/api/lojas', appAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const storesList = await PosRepository.getStores(user.tenantId);
    
    // Filtra de acordo com a unidade autorizada em modo Fail-Closed
    let authorizedList: typeof storesList = [];
    if (user.role === 'ADMINISTRADOR' || user.role === 'SUPER_ADMIN') {
      authorizedList = storesList;
    } else if (user.storeId) {
      authorizedList = storesList.filter(s => s.storeId === user.storeId);
    } else {
      // Usuário operacional sem storeId: NEGAR acesso
      return res.status(403).json({
        sucesso: false,
        erro: `Acesso negado: Usuário operacional com perfil '${user.role}' não possui unidade (loja) vinculada.`
      });
    }

    const formatted = authorizedList.map(s => ({
      id: s.storeId,
      nomeFantasia: s.tradeName,
      razaoSocial: s.corporateName,
      cnpj: s.cnpj,
      segmento: s.segment,
      endereco: s.address,
      telefone: s.phone,
      taxaServicoPadrao: Number(s.serviceTaxDefault),
      bloqueioLimiteComanda: Number(s.comandaLimitBlock)
    }));
    res.json({ sucesso: true, data: formatted });
  } catch (error: any) {
    res.status(500).json({ sucesso: false, erro: 'Falha ao buscar estabelecimentos no banco de dados.' });
  }
});

app.get('/api/lojas/:lojaId', appAuth, async (req: AuthRequest, res: Response) => {
  const { lojaId } = req.params;
  try {
    const access = await validateStoreAccess(req.user!, lojaId);
    if (!access.allowed) {
      return res.status(403).json({ sucesso: false, erro: access.error });
    }

    const loja = access.store;
    res.json({ 
      sucesso: true, 
      data: {
        id: loja.storeId,
        nomeFantasia: loja.tradeName,
        razaoSocial: loja.corporateName,
        cnpj: loja.cnpj,
        segmento: loja.segment,
        endereco: loja.address,
        telefone: loja.phone,
        taxaServicoPadrao: Number(loja.serviceTaxDefault),
        bloqueioLimiteComanda: Number(loja.comandaLimitBlock)
      } 
    });
  } catch (error: any) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

// Produtos e Estoque por Loja (Isolamento por Unidade e Tenant)
app.get('/api/lojas/:lojaId/produtos', appAuth, async (req: AuthRequest, res: Response) => {
  const { lojaId } = req.params;
  try {
    const access = await validateStoreAccess(req.user!, lojaId);
    if (!access.allowed) {
      return res.status(403).json({ sucesso: false, erro: access.error });
    }

    const lista = await PosRepository.getProductsByStore(lojaId, req.user!.tenantId);
    res.json({
      sucesso: true,
      total: lista.length,
      lojaId,
      data: lista
    });
  } catch (error: any) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

// Turno Atual do Caixa
app.get('/api/lojas/:lojaId/turnos/atual', appAuth, async (req: AuthRequest, res: Response) => {
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

    const { session, movimentacoes, saldoDinheiroGaveta } = current;

    res.json({
      sucesso: true,
      turnoAberto: true,
      data: {
        id: session.sessionId,
        estabelecimentoId: session.storeId,
        numeroTurno: session.sessionNumber,
        operadorId: session.operatorId,
        operadorNome: session.operatorName,
        fundoTrocoInicial: Number(session.initialFund),
        status: session.status,
        dataHoraAbertura: session.openedAt.toISOString(),
        systemCash: Number(session.systemCash),
        systemPix: Number(session.systemPix),
        systemCard: Number(session.systemCard)
      },
      saldoDinheiroGaveta,
      movimentacoes: movimentacoes.map(m => ({
        id: m.movementId,
        estabelecimentoId: m.storeId,
        turnoId: m.sessionId,
        tipo: m.type,
        valor: Number(m.amount),
        motivo: m.reason,
        operadorNome: m.operatorName,
        dataHora: m.timestamp.toISOString()
      }))
    });
  } catch (error: any) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

// Abertura de Turno de Caixa
app.post(
  '/api/lojas/:lojaId/turnos/abrir',
  appAuth,
  requireRole(['SUPER_ADMIN', 'ADMINISTRADOR', 'GERENTE', 'CAIXA', 'OPERADOR']),
  validateBody(aberturaTurnoSchema),
  async (req: AuthRequest, res: Response) => {
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

      // Emite evento seguro de notificação somente para o tenant
      io.to(`tenant:${req.user!.tenantId}`).emit('turno_caixa_atualizado', {
        tipo: 'ABERTURA',
        lojaId,
        turnoId: novoTurno.sessionId,
        operador: novoTurno.operatorName,
        fundo: Number(novoTurno.initialFund)
      });

      res.status(201).json({ 
        sucesso: true, 
        mensagem: 'Turno de caixa aberto com sucesso no PostgreSQL.', 
        data: novoTurno 
      });
    } catch (error: any) {
      res.status(400).json({ sucesso: false, erro: error.message });
    }
  }
);

// Sangria e Suprimento de Caixa
app.post(
  '/api/lojas/:lojaId/turnos/:turnoId/movimentacoes',
  appAuth,
  requireRole(['SUPER_ADMIN', 'ADMINISTRADOR', 'GERENTE', 'CAIXA']),
  validateBody(movimentacaoCaixaSchema),
  async (req: AuthRequest, res: Response) => {
    const { lojaId, turnoId } = req.params;
    const { tipo, valor, motivo } = req.body;

    try {
      const access = await validateStoreAccess(req.user!, lojaId);
      if (!access.allowed) {
        return res.status(403).json({ sucesso: false, erro: access.error });
      }

      const { mov, novoSaldo } = await PosRepository.addCashMovement({
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

      io.to(`tenant:${req.user!.tenantId}`).emit('movimentacao_caixa_realizada', {
        tipo,
        lojaId,
        valor: Number(valor),
        novoSaldoGaveta: novoSaldo,
        motivo: mov.reason,
        operador: mov.operatorName,
        horario: new Date().toLocaleTimeString('pt-BR')
      });

      res.status(201).json({ 
        sucesso: true, 
        mensagem: `${tipo} registrada com sucesso no banco de dados.`, 
        data: mov 
      });
    } catch (error: any) {
      res.status(400).json({ sucesso: false, erro: error.message });
    }
  }
);

// Transação Atômica de Venda (PDV Balcão com Idempotência por Fingerprint SHA-256 e Proteção Concorrente)
app.post(
  '/api/vendas',
  salesRateLimiter,
  appAuth,
  requireRole(['SUPER_ADMIN', 'ADMINISTRADOR', 'GERENTE', 'CAIXA', 'OPERADOR']),
  validateBody(vendaSchema),
  async (req: AuthRequest, res: Response) => {
    const { lojaId: frontendLojaId, formaPagamento, valor, itens, descontoSolicitado, simulateFailureAfterStock } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

    try {
      const user = req.user!;

      // 1. ISOLAMENTO DE LOJA & ZERO-TRUST NO FRONTEND:
      // Para perfis operacionais (GERENTE, CAIXA, OPERADOR), a unidade autorizada é estritamente a do usuário no banco.
      let effectiveStoreId: string;

      if (user.role === 'ADMINISTRADOR' || user.role === 'SUPER_ADMIN') {
        effectiveStoreId = frontendLojaId || user.storeId || '';
      } else {
        // Usuário operacional:
        if (!user.storeId) {
          return res.status(403).json({
            sucesso: false,
            erro: `Acesso negado: Usuário operacional com perfil '${user.role}' não possui unidade (loja) vinculada.`
          });
        }
        if (frontendLojaId && frontendLojaId !== user.storeId) {
          return res.status(403).json({
            sucesso: false,
            erro: `Acesso negado: Seu usuário está vinculado à unidade '${user.storeId}' e não pode registrar vendas na unidade '${frontendLojaId}'.`
          });
        }
        effectiveStoreId = user.storeId;
      }

      const access = await validateStoreAccess(user, effectiveStoreId);
      if (!access.allowed) {
        return res.status(access.statusCode || 403).json({ sucesso: false, erro: access.error });
      }

      // Calcula fingerprint determinístico da requisição para prevenção de colisões e reuso indevido de chave
      const fingerprint = idempotencyKey
        ? generateRequestFingerprint({
            tenantId: user.tenantId,
            storeId: effectiveStoreId,
            endpoint: 'POST /api/vendas',
            payload: req.body
          })
        : undefined;

      // O backend NÃO confia em preços, descontos, usuários ou estoques enviados pelo frontend.
      // O repositório PosRepository.processQuickSale busca os preços cadastrados no PostgreSQL,
      // recalcula os subtotais e totais, bloqueia linhas com FOR UPDATE e garante atomicidade com ROLLBACK.
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
        simulateFailureAfterStock: Boolean(simulateFailureAfterStock && !isProduction)
      });

      if (result.isIdempotentReplay) {
        return res.status(200).json(result.data);
      }

      // Notificação via WebSocket segura apenas no canal do Tenant
      const saleOrder = (result.data as any).order;
      io.to(`tenant:${user.tenantId}`).emit('nova_venda_realizada', {
        orderId: saleOrder?.orderId,
        lojaId: effectiveStoreId,
        item: `Venda Balcão #${saleOrder?.orderNumber || '0'}`,
        valor: Number(saleOrder?.total || valor || 0),
        formaPagamento,
        operador: user.name,
        horario: new Date().toLocaleTimeString('pt-BR')
      });

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

// Fechamento de Turno de Caixa
app.post(
  '/api/fechamento/:lojaId',
  adminRateLimiter,
  appAuth,
  requireRole(['SUPER_ADMIN', 'ADMINISTRADOR', 'GERENTE', 'CAIXA']),
  validateBody(fechamentoCaixaSchema),
  async (req: AuthRequest, res: Response) => {
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

      io.to(`tenant:${req.user!.tenantId}`).emit('fechamento_caixa_concluido', {
        lojaId,
        turnoId: closed.sessionId,
        operador: closed.operatorName,
        diferenca: Number(closed.cashDifference)
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
  }
);

// Fechamento Consolidado das Unidades (Acesso Gerencial/Financeiro com Isolamento de Loja)
app.get(
  '/api/fechamento/consolidado',
  appAuth,
  requireRole(['SUPER_ADMIN', 'ADMINISTRADOR', 'GERENTE', 'FINANCEIRO']),
  async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const storesList = await PosRepository.getStores(user.tenantId);

      let authorizedStores = storesList;
      if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMINISTRADOR') {
        if (!user.storeId) {
          return res.status(403).json({
            sucesso: false,
            erro: `Acesso negado: Usuário com perfil '${user.role}' não possui unidade vinculada.`
          });
        }
        authorizedStores = storesList.filter(s => s.storeId === user.storeId);
      }

      const caixas = await Promise.all(authorizedStores.map(async (s, index) => {
        const current = await PosRepository.getCurrentCashSession(s.storeId, user.tenantId);
        const session = current?.session;
        return {
          id: index + 1,
          estabelecimentoId: s.storeId,
          loja: s.tradeName,
          operador: session ? session.operatorName : 'Nenhum Turno Aberto',
          dinheiroSistema: session ? Number(session.systemCash) : 0,
          pixSistema: session ? Number(session.systemPix) : 0,
          cartaoSistema: session ? Number(session.systemCard) : 0,
          dinheiroInformado: ''
        };
      }));

      const totalGeralVendas = caixas.reduce((acc, c) => acc + c.dinheiroSistema + c.pixSistema + c.cartaoSistema, 0);

      res.json({
        sucesso: true,
        dataHoraGeracao: new Date().toISOString(),
        totalGeralVendas,
        caixas
      });
    } catch (error: any) {
      res.status(500).json({ sucesso: false, erro: error.message });
    }
  }
);

// Auditoria Real (Audit Logs) com Isolamento Rigoroso de Loja
app.get(
  '/api/v1/audit/logs',
  adminRateLimiter,
  appAuth,
  requireRole(['SUPER_ADMIN', 'ADMINISTRADOR', 'GERENTE']),
  async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      let storeId = req.query.storeId as string | undefined;

      if (user.role === 'GERENTE') {
        if (!user.storeId) {
          return res.status(403).json({
            sucesso: false,
            erro: 'Acesso negado: Gerente sem unidade vinculada.'
          });
        }
        if (storeId && storeId !== user.storeId) {
          return res.status(403).json({
            sucesso: false,
            erro: 'Acesso negado: Gerente só pode auditar a sua própria unidade vinculada.'
          });
        }
        storeId = user.storeId;
      }

      const logs = await PosRepository.getAuditLogs(storeId, user.tenantId);
      res.json({ sucesso: true, total: logs.length, data: logs });
    } catch (error: any) {
      res.status(500).json({ sucesso: false, erro: error.message });
    }
  }
);

// Usuários e Gestão de Acessos RBAC
app.get(
  '/api/v1/auth/users',
  adminRateLimiter,
  appAuth,
  requireRole(['SUPER_ADMIN', 'ADMINISTRADOR']),
  async (req: AuthRequest, res: Response) => {
    try {
      const userList = await PosRepository.getUsers(req.user!.tenantId);
      res.json({ 
        sucesso: true, 
        data: userList.map(u => ({
          id: u.uid,
          nome: u.name,
          email: u.email,
          role: u.role,
          lojaId: u.storeId,
          active: u.active
        }))
      });
    } catch (error: any) {
      res.status(500).json({ sucesso: false, erro: error.message });
    }
  }
);

// ============================================================================
// CADASTRO E CONVITE DE FUNCIONÁRIOS COM PERFIL OPERADOR (FASE 2)
// ============================================================================

// Listar funcionários do estabelecimento (perfil OPERADOR)
app.get(
  ['/api/v1/employees', '/api/v1/auth/employees'],
  adminRateLimiter,
  appAuth,
  requireRole(['SUPER_ADMIN', 'ADMINISTRADOR']),
  async (req: AuthRequest, res: Response) => {
    try {
      const employees = await PosRepository.getEmployees(req.user!.tenantId);
      res.json({ sucesso: true, data: employees });
    } catch (error: any) {
      res.status(500).json({ sucesso: false, erro: error.message });
    }
  }
);

// Cadastrar e convidar novo funcionário (estritamente perfil OPERADOR)
app.post(
  ['/api/v1/employees', '/api/v1/auth/employees', '/api/v1/auth/users/invite'],
  adminRateLimiter,
  appAuth,
  requireRole(['SUPER_ADMIN', 'ADMINISTRADOR']),
  validateBody(createEmployeeSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      // Regra 9: Rejeição estrita se o frontend enviar qualquer role que não seja OPERADOR
      if (req.body.role && req.body.role !== 'OPERADOR') {
        return res.status(400).json({
          sucesso: false,
          erro: 'Violação de segurança: Este fluxo permite exclusivamente o cadastro de funcionários com perfil OPERADOR.'
        });
      }

      const { nome, email, lojaId, status } = req.body;
      const appUrl = `${req.protocol}://${req.get('host')}`;

      const novoFuncionario = await PosRepository.createOperatorEmployee({
        tenantId: req.user!.tenantId,
        storeId: lojaId,
        name: nome,
        email: email,
        status: status || 'ACTIVE',
        createdByUserId: req.user!.uid,
        createdByUserName: req.user!.name,
        ipAddress: req.ip,
        appUrl
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

// Ativar ou desativar funcionário (apenas ADMINISTRADOR e apenas OPERADOR)
app.patch(
  ['/api/v1/employees/:id/status', '/api/v1/auth/employees/:id/status'],
  adminRateLimiter,
  appAuth,
  requireRole(['SUPER_ADMIN', 'ADMINISTRADOR']),
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
        ipAddress: req.ip
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

// Vincular / alterar loja do funcionário (apenas ADMINISTRADOR)
app.patch(
  ['/api/v1/employees/:id/store', '/api/v1/auth/employees/:id/store'],
  adminRateLimiter,
  appAuth,
  requireRole(['SUPER_ADMIN', 'ADMINISTRADOR']),
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
        ipAddress: req.ip
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

// Reenviar convite de acesso para funcionário
app.post(
  ['/api/v1/employees/:id/resend-invite', '/api/v1/auth/employees/:id/resend-invite'],
  adminRateLimiter,
  appAuth,
  requireRole(['SUPER_ADMIN', 'ADMINISTRADOR']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const appUrl = `${req.protocol}://${req.get('host')}`;

      const resultado = await PosRepository.resendEmployeeInvitation({
        tenantId: req.user!.tenantId,
        employeeId: id,
        createdByUserId: req.user!.uid,
        createdByUserName: req.user!.name,
        ipAddress: req.ip,
        appUrl
      });

      res.json({
        sucesso: true,
        mensagem: 'Novo convite gerado com sucesso.',
        data: resultado
      });
    } catch (error: any) {
      const isNotFound = error.message.includes('não encontrado');
      const status = isNotFound ? 404 : 500;
      res.status(status).json({ sucesso: false, erro: error.message });
    }
  }
);

// Consultar dados públicos de um convite a partir do token
app.get(
  '/api/v1/invitations/:token',
  authRateLimiter,
  async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const convite = await PosRepository.getInvitationByToken(token);
      if (!convite) {
        return res.status(404).json({ sucesso: false, erro: 'Convite não encontrado ou token inválido.' });
      }
      res.json({ sucesso: true, data: convite });
    } catch (error: any) {
      res.status(500).json({ sucesso: false, erro: error.message });
    }
  }
);

// Aceitar convite de funcionário e configurar credenciais/PIN
app.post(
  '/api/v1/invitations/:token/accept',
  authRateLimiter,
  validateBody(acceptInvitationSchema),
  async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const { pin, name } = req.body;

      const resultado = await PosRepository.acceptEmployeeInvitation(token, pin, name);
      res.json({
        sucesso: true,
        mensagem: 'Convite aceito com sucesso. Sua conta de OPERADOR está ativa.',
        data: resultado
      });
    } catch (error: any) {
      const isClientError = error.message.includes('inválido') || error.message.includes('expirou') || error.message.includes('anteriormente');
      res.status(isClientError ? 400 : 500).json({ sucesso: false, erro: error.message });
    }
  }
);


// ============================================================================
// CONSULTA SEGURA INDIVIDUAL COM ISOLAMENTO DE TENANT E LOJA (HTTP 404/403)
// ============================================================================

app.get('/api/produtos/:productId', appAuth, async (req: AuthRequest, res: Response) => {
  const { productId } = req.params;
  try {
    const [product] = await db.select().from(products)
      .where(and(
        eq(products.productId, productId),
        eq(products.tenantId, req.user!.tenantId)
      ));

    if (!product) {
      return res.status(404).json({ 
        sucesso: false, 
        erro: 'Produto não encontrado ou pertencente a outra organização.' 
      });
    }

    res.json({ sucesso: true, data: product });
  } catch (error: any) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

app.get('/api/vendas/:orderId', appAuth, async (req: AuthRequest, res: Response) => {
  const { orderId } = req.params;
  try {
    const user = req.user!;
    const [order] = await db.select().from(orders)
      .where(and(
        eq(orders.orderId, orderId),
        eq(orders.tenantId, user.tenantId)
      ));

    if (!order) {
      return res.status(404).json({ 
        sucesso: false, 
        erro: 'Pedido não encontrado ou pertencente a outra organização.' 
      });
    }

    // Isolamento de Loja: Perfis operacionais só acessam pedidos da sua unidade vinculada
    if (user.role !== 'ADMINISTRADOR' && user.role !== 'SUPER_ADMIN') {
      if (!user.storeId || order.storeId !== user.storeId) {
        return res.status(403).json({
          sucesso: false,
          erro: 'Acesso negado: Este pedido pertence a outra unidade.'
        });
      }
    }

    const items = await db.select().from(orderItems)
      .where(and(
        eq(orderItems.orderId, orderId),
        eq(orderItems.tenantId, user.tenantId)
      ));

    res.json({ sucesso: true, data: { ...order, items } });
  } catch (error: any) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

app.get('/api/turnos/:sessionId', appAuth, async (req: AuthRequest, res: Response) => {
  const { sessionId } = req.params;
  try {
    const user = req.user!;
    const [session] = await db.select().from(cashSessions)
      .where(and(
        eq(cashSessions.sessionId, sessionId),
        eq(cashSessions.tenantId, user.tenantId)
      ));

    if (!session) {
      return res.status(404).json({ 
        sucesso: false, 
        erro: 'Sessão de caixa não encontrada ou pertencente a outra organização.' 
      });
    }

    // Isolamento de Loja: Perfis operacionais só acessam sessões da sua unidade vinculada
    if (user.role !== 'ADMINISTRADOR' && user.role !== 'SUPER_ADMIN') {
      if (!user.storeId || session.storeId !== user.storeId) {
        return res.status(403).json({
          sucesso: false,
          erro: 'Acesso negado: Esta sessão de caixa pertence a outra unidade.'
        });
      }
    }

    res.json({ sucesso: true, data: session });
  } catch (error: any) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

app.get('/api/notificacoes/:notificationId', appAuth, async (req: AuthRequest, res: Response) => {
  const { notificationId } = req.params;
  try {
    const user = req.user!;
    const [notif] = await db.select().from(notifications)
      .where(and(
        eq(notifications.notificationId, notificationId),
        eq(notifications.tenantId, user.tenantId)
      ));

    if (!notif) {
      return res.status(404).json({ 
        sucesso: false, 
        erro: 'Notificação não encontrada ou pertencente a outra organização.' 
      });
    }

    // Isolamento de Loja: Se a notificação for vinculada a uma loja e o usuário for operacional
    if (user.role !== 'ADMINISTRADOR' && user.role !== 'SUPER_ADMIN') {
      if (notif.storeId && (!user.storeId || notif.storeId !== user.storeId)) {
        return res.status(403).json({
          sucesso: false,
          erro: 'Acesso negado: Esta notificação pertence a outra unidade.'
        });
      }
    }

    res.json({ sucesso: true, data: notif });
  } catch (error: any) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

// Tratamento centralizado de erros (CORS, 500 sem stack trace em produção)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err?.message && (err.message.includes('Bloqueado por CORS') || err.message.includes('Bloqueado por política de CORS'))) {
    return res.status(403).json({
      sucesso: false,
      erro: err.message
    });
  }

  const status = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';
  return res.status(status).json({
    sucesso: false,
    erro: isProd && status === 500 ? 'Erro interno no processamento do servidor.' : (err.message || 'Erro interno.'),
    ...(isProd ? {} : { stack: err.stack })
  });
});

// ============================================================================
// 5. VITE MIDDLEWARE & STATIC ASSETS
// ============================================================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[GESTÃO INTELLIGENCE OS] Servidor rodando na porta ${PORT} com PostgreSQL e Segurança Fase 1.5 ativa.`);
  });
}

startServer();
