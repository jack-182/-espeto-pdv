import { db } from './index.ts';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import crypto from 'crypto';
import { verifyPinScrypt, hashPinScrypt } from '../lib/security.ts';
import { IdempotencyConflictError } from '../lib/idempotency.ts';
import { SupervisorPinProtection } from '../middleware/rateLimiter.ts';
import { 
  tenants, 
  stores, 
  products, 
  storeInventories, 
  cashSessions, 
  cashMovements, 
  orders, 
  orderItems, 
  payments, 
  stockMovements, 
  auditLogs, 
  notifications,
  aiInsights,
  users,
  userInvitations,
  idempotencyKeys
} from './schema.ts';

// ============================================================================
// REPOSITÓRIO TRANSAÇÃO & PERSISTÊNCIA REAL NO POSTGRESQL (HARDENING SEGURO)
// ============================================================================

export const PosRepository = {
  // Lojas & Estabelecimentos (Isolamento por Tenant Obrigatório)
  async getStores(tenantId: string) {
    return await db.select().from(stores).where(eq(stores.tenantId, tenantId));
  },

  async getStoreById(storeId: string, tenantId: string) {
    const result = await db.select().from(stores)
      .where(and(eq(stores.storeId, storeId), eq(stores.tenantId, tenantId)));
    return result[0] || null;
  },

  // Produtos e Estoque por Loja
  async getProductsByStore(storeId: string, tenantId: string) {
    const prods = await db.select().from(products)
      .where(and(eq(products.tenantId, tenantId), eq(products.active, true)));

    const inventories = await db.select().from(storeInventories)
      .where(and(eq(storeInventories.storeId, storeId), eq(storeInventories.tenantId, tenantId)));

    const invMap = new Map(inventories.map(inv => [inv.productId, inv]));

    return prods.map(p => {
      const inv = invMap.get(p.productId);
      return {
        id: p.productId,
        estabelecimentoId: storeId,
        codigoBarras: p.barcode || '',
        nome: p.name,
        categoria: p.categoryId,
        precoVenda: inv?.salePriceCustom ? Number(inv.salePriceCustom) : Number(p.salePrice),
        precoCusto: Number(p.costPrice),
        estoqueAtual: inv ? inv.currentStock : 0,
        estoqueMinimo: inv ? inv.minStock : p.stockMin,
        unidade: p.unit,
        atalhoRapido: p.isQuickSale
      };
    });
  },

  // Turno e Caixa Ativo com cálculo de saldo rigoroso
  async getCurrentCashSession(storeId: string, tenantId: string) {
    const sessions = await db.select().from(cashSessions)
      .where(and(
        eq(cashSessions.storeId, storeId),
        eq(cashSessions.tenantId, tenantId),
        eq(cashSessions.status, 'ABERTO')
      ))
      .orderBy(desc(cashSessions.openedAt));

    if (!sessions.length) return null;
    const session = sessions[0];

    const movs = await db.select().from(cashMovements)
      .where(and(
        eq(cashMovements.sessionId, session.sessionId),
        eq(cashMovements.tenantId, tenantId)
      ))
      .orderBy(desc(cashMovements.timestamp));

    // Cálculo exato de caixa a partir das movimentações reais
    let saldoDinheiro = Number(session.initialFund);
    let totalPix = 0;
    let totalCartao = 0;

    for (const m of movs) {
      const val = Number(m.amount);
      if (m.type === 'SUPRIMENTO' || (m.type === 'VENDA' && m.paymentMethod === 'DINHEIRO')) {
        saldoDinheiro += val;
      } else if (m.type === 'SANGRIA' || m.type === 'ESTORNO') {
        saldoDinheiro -= val;
      } else if (m.type === 'VENDA' && m.paymentMethod === 'PIX') {
        totalPix += val;
      } else if (m.type === 'VENDA' && (m.paymentMethod === 'CARTAO_DEBITO' || m.paymentMethod === 'CARTAO_CREDITO')) {
        totalCartao += val;
      }
    }

    return {
      session: {
        ...session,
        systemCash: saldoDinheiro.toFixed(2),
        systemPix: totalPix.toFixed(2),
        systemCard: totalCartao.toFixed(2)
      },
      movimentacoes: movs,
      saldoDinheiroGaveta: saldoDinheiro
    };
  },

  // Abertura de Caixa Transacional
  async openCashSession(params: {
    tenantId: string;
    storeId: string;
    operatorId: string;
    operatorName: string;
    initialFund: number;
    ipAddress?: string;
  }) {
    return await db.transaction(async (tx) => {
      // 1. Verifica se já existe caixa aberto para a unidade
      const existing = await tx.select().from(cashSessions)
        .where(and(
          eq(cashSessions.storeId, params.storeId),
          eq(cashSessions.tenantId, params.tenantId),
          eq(cashSessions.status, 'ABERTO')
        ));

      if (existing.length > 0) {
        throw new Error('Já existe um turno de caixa aberto para esta unidade.');
      }

      const sessionId = `turno-${params.storeId}-${Date.now()}`;
      const sessionCount = await tx.select({ count: sql<number>`count(*)` }).from(cashSessions)
        .where(and(eq(cashSessions.storeId, params.storeId), eq(cashSessions.tenantId, params.tenantId)));
      
      const sessionNumber = Number(sessionCount[0]?.count || 0) + 1;

      const [newSession] = await tx.insert(cashSessions).values({
        sessionId,
        tenantId: params.tenantId,
        storeId: params.storeId,
        sessionNumber,
        operatorId: params.operatorId,
        operatorName: params.operatorName,
        initialFund: params.initialFund.toFixed(2),
        systemCash: params.initialFund.toFixed(2),
        systemPix: '0.00',
        systemCard: '0.00',
        status: 'ABERTO',
      }).returning();

      // Registra movimentação do fundo de troco
      await tx.insert(cashMovements).values({
        movementId: `mov-${Date.now()}`,
        tenantId: params.tenantId,
        storeId: params.storeId,
        sessionId,
        type: 'SUPRIMENTO',
        amount: params.initialFund.toFixed(2),
        paymentMethod: 'DINHEIRO',
        reason: 'Abertura de Turno - Fundo de Troco',
        operatorId: params.operatorId,
        operatorName: params.operatorName
      });

      // Auditoria Imutável
      await tx.insert(auditLogs).values({
        tenantId: params.tenantId,
        storeId: params.storeId,
        userId: params.operatorId,
        userName: params.operatorName,
        action: 'ABERTURA_CAIXA',
        entity: 'cash_sessions',
        entityId: sessionId,
        newValues: { initialFund: params.initialFund, sessionNumber },
        ipAddress: params.ipAddress
      });

      return newSession;
    });
  },

  // Sangria ou Suprimento com Trava Rigorosa de Saldo em Dinheiro
  async addCashMovement(params: {
    tenantId: string;
    storeId: string;
    sessionId: string;
    type: 'SANGRIA' | 'SUPRIMENTO';
    amount: number;
    paymentMethod?: string;
    reason: string;
    operatorId: string;
    operatorName: string;
    authorizedBy?: string;
    ipAddress?: string;
  }) {
    return await db.transaction(async (tx) => {
      // 1. Busca a sessão de caixa e valida se está aberta
      const [session] = await tx.select().from(cashSessions)
        .where(and(
          eq(cashSessions.sessionId, params.sessionId),
          eq(cashSessions.tenantId, params.tenantId),
          eq(cashSessions.storeId, params.storeId)
        ))
        .for('update'); // Row locking para consistência concorrente

      if (!session) {
        throw new Error('Turno de caixa não encontrado ou não pertence a esta unidade.');
      }

      if (session.status !== 'ABERTO') {
        throw new Error('Não é possível movimentar um caixa que não esteja aberto.');
      }

      const saldoAtual = Number(session.systemCash);

      // Trava de segurança: impede sangria acima do saldo existente na gaveta
      if (params.type === 'SANGRIA' && params.amount > saldoAtual) {
        throw new Error(`Saldo insuficiente na gaveta para sangria. Saldo disponível: R$ ${saldoAtual.toFixed(2)}, Solicitado: R$ ${params.amount.toFixed(2)}.`);
      }

      const novoSaldo = params.type === 'SUPRIMENTO' 
        ? saldoAtual + params.amount 
        : saldoAtual - params.amount;

      // 2. Registra a movimentação
      const [mov] = await tx.insert(cashMovements).values({
        movementId: `mov-${Date.now()}`,
        tenantId: params.tenantId,
        storeId: params.storeId,
        sessionId: params.sessionId,
        type: params.type,
        amount: params.amount.toFixed(2),
        paymentMethod: params.paymentMethod || 'DINHEIRO',
        reason: params.reason,
        operatorId: params.operatorId,
        operatorName: params.operatorName,
        authorizedBy: params.authorizedBy
      }).returning();

      // 3. Atualiza saldo da sessão
      await tx.update(cashSessions)
        .set({ systemCash: novoSaldo.toFixed(2) })
        .where(eq(cashSessions.sessionId, params.sessionId));

      // 4. Auditoria
      await tx.insert(auditLogs).values({
        tenantId: params.tenantId,
        storeId: params.storeId,
        userId: params.operatorId,
        userName: params.operatorName,
        action: params.type,
        entity: 'cash_movements',
        entityId: mov.movementId,
        oldValues: { saldoAnterior: saldoAtual },
        newValues: { amount: params.amount, novoSaldo, reason: params.reason, authorizedBy: params.authorizedBy },
        ipAddress: params.ipAddress
      });

      return { mov, novoSaldo };
    });
  },

  // Fechamento de Turno de Caixa Transacional e Seguro contra Fechamento Duplo
  async closeCashSession(params: {
    tenantId: string;
    storeId: string;
    sessionId: string;
    operatorId: string;
    operatorName: string;
    declaredCash: number;
    declaredPix?: number;
    declaredCard?: number;
    notes?: string;
    ipAddress?: string;
  }) {
    return await db.transaction(async (tx) => {
      // 1. Busca e trava a sessão de caixa
      const [session] = await tx.select().from(cashSessions)
        .where(and(
          eq(cashSessions.sessionId, params.sessionId),
          eq(cashSessions.tenantId, params.tenantId),
          eq(cashSessions.storeId, params.storeId)
        ))
        .for('update');

      if (!session) {
        throw new Error('Turno de caixa não encontrado.');
      }

      // Trava contra fechamento duplo
      if (session.status !== 'ABERTO') {
        throw new Error(`Turno já está ${session.status}. Fechamento duplicado proibido.`);
      }

      // 2. Calcula os totais do sistema diretamente das movimentações da sessão
      const movs = await tx.select().from(cashMovements)
        .where(eq(cashMovements.sessionId, params.sessionId));

      let calcCash = Number(session.initialFund);
      let calcPix = 0;
      let calcCard = 0;

      for (const m of movs) {
        const val = Number(m.amount);
        if (m.type === 'SUPRIMENTO' || (m.type === 'VENDA' && m.paymentMethod === 'DINHEIRO')) {
          calcCash += val;
        } else if (m.type === 'SANGRIA' || m.type === 'ESTORNO') {
          calcCash -= val;
        } else if (m.type === 'VENDA' && m.paymentMethod === 'PIX') {
          calcPix += val;
        } else if (m.type === 'VENDA' && (m.paymentMethod === 'CARTAO_DEBITO' || m.paymentMethod === 'CARTAO_CREDITO')) {
          calcCard += val;
        }
      }

      const diffCash = params.declaredCash - calcCash;

      // 3. Atualiza a sessão para FECHADO
      const [updated] = await tx.update(cashSessions)
        .set({
          status: 'FECHADO',
          closedAt: new Date(),
          systemCash: calcCash.toFixed(2),
          systemPix: calcPix.toFixed(2),
          systemCard: calcCard.toFixed(2),
          declaredCash: params.declaredCash.toFixed(2),
          declaredPix: (params.declaredPix || 0).toFixed(2),
          declaredCard: (params.declaredCard || 0).toFixed(2),
          cashDifference: diffCash.toFixed(2),
          notes: params.notes
        })
        .where(eq(cashSessions.sessionId, params.sessionId))
        .returning();

      // 4. Auditoria
      await tx.insert(auditLogs).values({
        tenantId: params.tenantId,
        storeId: params.storeId,
        userId: params.operatorId,
        userName: params.operatorName,
        action: 'FECHAMENTO_CAIXA',
        entity: 'cash_sessions',
        entityId: params.sessionId,
        oldValues: { status: 'ABERTO' },
        newValues: {
          declaredCash: params.declaredCash,
          systemCash: calcCash,
          diferenca: diffCash,
          status: 'FECHADO'
        },
        ipAddress: params.ipAddress
      });

      return updated;
    });
  },

  // Transação Atômica de Venda com Idempotência e Autoridade Total do Backend sobre Preços e Estoque
  async processQuickSale(params: {
    tenantId: string;
    storeId: string;
    items: Array<{ productId: string; quantity: number; unitPrice?: number }>;
    paymentMethod: 'DINHEIRO' | 'PIX' | 'CARTAO_DEBITO' | 'CARTAO_CREDITO' | 'OUTROS';
    total?: number; // Preço/total do cliente é IGNORADO. O servidor recalcula 100% via banco!
    discountRequested?: number;
    operatorId: string;
    operatorName: string;
    idempotencyKey?: string;
    fingerprint?: string;
    requestPath?: string;
    ipAddress?: string;
    simulateFailureAfterStock?: boolean;
  }) {
    // Chave de idempotência isolada por tenant
    const idempKey = params.idempotencyKey;

    // 1. Verificação prévia de Idempotência
    if (idempKey) {
      const existingKey = await db.select().from(idempotencyKeys)
        .where(and(
          eq(idempotencyKeys.key, idempKey),
          eq(idempotencyKeys.tenantId, params.tenantId)
        ));

      if (existingKey.length > 0) {
        const record = existingKey[0];
        // Se o fingerprint armazenado for diferente do fingerprint da requisição atual -> 409 Conflict
        if (record.fingerprint && params.fingerprint && record.fingerprint !== params.fingerprint) {
          throw new IdempotencyConflictError();
        }
        return {
          isIdempotentReplay: true,
          data: record.responseBody,
          statusCode: record.statusCode || 200
        };
      }
    }

    try {
      return await db.transaction(async (tx) => {
        // 1.5. Verificação de Idempotência dentro da transação para requests simultâneos
        if (idempKey) {
          const inTxKey = await tx.select().from(idempotencyKeys)
            .where(and(
              eq(idempotencyKeys.key, idempKey),
              eq(idempotencyKeys.tenantId, params.tenantId)
            ));
          if (inTxKey.length > 0) {
            const record = inTxKey[0];
            if (record.fingerprint && params.fingerprint && record.fingerprint !== params.fingerprint) {
              throw new IdempotencyConflictError();
            }
            return {
              isIdempotentReplay: true,
              data: record.responseBody,
              statusCode: record.statusCode || 200
            };
          }
        }

        // 2. Busca o turno de caixa ativo
        const sessions = await tx.select().from(cashSessions)
          .where(and(
            eq(cashSessions.storeId, params.storeId),
            eq(cashSessions.tenantId, params.tenantId),
            eq(cashSessions.status, 'ABERTO')
          ));

        const activeSession = sessions[0] || null;
        const orderId = `venda-${params.storeId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const orderNumber = Math.floor(Math.random() * 9000) + 1000;

        // 3. Validação do Catálogo e Busca Autoritativa de Preços e Estoque no Banco de Dados
        let calculatedSubtotal = 0;
        const processedItems: Array<{
          productId: string;
          productName: string;
          quantity: number;
          authoritativeUnitPrice: number;
          itemSubtotal: number;
          invId: number;
          currentStock: number;
          newStock: number;
        }> = [];

        for (const it of params.items) {
          if (!it.quantity || it.quantity <= 0) {
            throw new Error('Quantidade do item deve ser um número inteiro positivo maior que zero.');
          }

          // Busca o produto oficial no PostgreSQL (Isolamento por Tenant estrito)
          const [prod] = await tx.select().from(products)
            .where(and(
              eq(products.productId, it.productId),
              eq(products.tenantId, params.tenantId)
            ));

          if (!prod) {
            throw new Error(`Produto ${it.productId} não encontrado ou não pertence à sua organização.`);
          }

          if (!prod.active) {
            throw new Error(`Produto "${prod.name}" está inativo para comercialização.`);
          }

          // Bloqueia a linha do inventário para atualização exclusiva na transação (Row Locking)
          const [inv] = await tx.select().from(storeInventories)
            .where(and(
              eq(storeInventories.storeId, params.storeId),
              eq(storeInventories.productId, it.productId),
              eq(storeInventories.tenantId, params.tenantId)
            ))
            .for('update');

          if (!inv) {
            throw new Error(`Inventário não configurado para o produto "${prod.name}" nesta unidade.`);
          }

          if (inv.currentStock < it.quantity) {
            throw new Error(`Estoque insuficiente para "${prod.name}". Saldo disponível: ${inv.currentStock}, Solicitado: ${it.quantity}.`);
          }

          // O BACKEND É A AUTORIDADE ABSOLUTA SOBRE O PREÇO:
          // Utiliza o preço customizado da loja ou o preço de venda da tabela de produtos do banco
          const authoritativeUnitPrice = inv.salePriceCustom ? Number(inv.salePriceCustom) : Number(prod.salePrice);
          const itemSubtotal = Math.round(authoritativeUnitPrice * it.quantity * 100) / 100;
          calculatedSubtotal = Math.round((calculatedSubtotal + itemSubtotal) * 100) / 100;

          const newStock = inv.currentStock - it.quantity;

          processedItems.push({
            productId: it.productId,
            productName: prod.name,
            quantity: it.quantity,
            authoritativeUnitPrice,
            itemSubtotal,
            invId: inv.id,
            currentStock: inv.currentStock,
            newStock
          });
        }

        // 4. Validação de Desconto no Backend (Regra de Negócio: teto máximo permitido de 15% sem autorização especial)
        let appliedDiscount = 0;
        if (params.discountRequested && params.discountRequested > 0) {
          const maxAllowedDiscount = Math.round(calculatedSubtotal * 0.15 * 100) / 100;
          appliedDiscount = Math.min(params.discountRequested, maxAllowedDiscount);
        }

        const authoritativeTotal = Math.round((calculatedSubtotal - appliedDiscount) * 100) / 100;

        // 5. Baixa de Estoque e Registro Histórico de Movimentações
        for (const item of processedItems) {
          await tx.update(storeInventories)
            .set({ currentStock: item.newStock, updatedAt: new Date() })
            .where(eq(storeInventories.id, item.invId));

          await tx.insert(stockMovements).values({
            movementId: `mov-stk-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            tenantId: params.tenantId,
            storeId: params.storeId,
            productId: item.productId,
            movementType: 'SALE',
            quantity: -item.quantity,
            previousStock: item.currentStock,
            newStock: item.newStock,
            reason: `Venda Balcão PDV #${orderNumber}`,
            orderId,
            operatorId: params.operatorId,
            operatorName: params.operatorName
          });
        }

        // Suporte a teste de rollback atômico: se solicitado em ambiente controlado (fora de produção), simula falha após baixa de estoque
        if (params.simulateFailureAfterStock && process.env.NODE_ENV !== 'production') {
          throw new Error('SIMULATED_TRANSACTION_FAILURE: Falha forçada após baixa de estoque para teste de rollback atômico.');
        }

        // 6. Criação do Pedido com Valores Finais Calculados pelo Servidor
        const [order] = await tx.insert(orders).values({
          orderId,
          tenantId: params.tenantId,
          storeId: params.storeId,
          sessionId: activeSession?.sessionId,
          orderNumber,
          type: 'BALCAO_RAPIDO',
          status: 'PAID',
          operatorId: params.operatorId,
          operatorName: params.operatorName,
          subtotal: calculatedSubtotal.toFixed(2),
          discount: appliedDiscount.toFixed(2),
          total: authoritativeTotal.toFixed(2),
          closedAt: new Date()
        }).returning();

        // 7. Criação dos Itens do Pedido com Preços Oficiais
        for (const item of processedItems) {
          const itemId = `item-${Date.now()}-${Math.random().toString(36).substring(7)}`;

          await tx.insert(orderItems).values({
            itemId,
            orderId,
            tenantId: params.tenantId,
            storeId: params.storeId,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.authoritativeUnitPrice.toFixed(2),
            discount: '0.00',
            total: item.itemSubtotal.toFixed(2),
            addedBy: params.operatorName,
            status: 'ACTIVE'
          });
        }

        // 8. Registro do Pagamento
        await tx.insert(payments).values({
          paymentId: `pay-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          tenantId: params.tenantId,
          storeId: params.storeId,
          orderId,
          sessionId: activeSession?.sessionId,
          method: params.paymentMethod,
          amount: authoritativeTotal.toFixed(2),
          status: 'CONFIRMED'
        });

        // 9. Atualização do Caixa Aberto (se houver)
        if (activeSession) {
          await tx.insert(cashMovements).values({
            movementId: `mov-venda-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            tenantId: params.tenantId,
            storeId: params.storeId,
            sessionId: activeSession.sessionId,
            type: 'VENDA',
            amount: authoritativeTotal.toFixed(2),
            paymentMethod: params.paymentMethod,
            reason: `Venda Balcão #${orderNumber}`,
            operatorId: params.operatorId,
            operatorName: params.operatorName
          });

          if (params.paymentMethod === 'DINHEIRO') {
            await tx.update(cashSessions)
              .set({ systemCash: sql`${cashSessions.systemCash} + ${authoritativeTotal}` })
              .where(eq(cashSessions.sessionId, activeSession.sessionId));
          } else if (params.paymentMethod === 'PIX') {
            await tx.update(cashSessions)
              .set({ systemPix: sql`${cashSessions.systemPix} + ${authoritativeTotal}` })
              .where(eq(cashSessions.sessionId, activeSession.sessionId));
          } else {
            await tx.update(cashSessions)
              .set({ systemCard: sql`${cashSessions.systemCard} + ${authoritativeTotal}` })
              .where(eq(cashSessions.sessionId, activeSession.sessionId));
          }
        }

        // 10. Auditoria Financeira
        await tx.insert(auditLogs).values({
          tenantId: params.tenantId,
          storeId: params.storeId,
          userId: params.operatorId,
          userName: params.operatorName,
          action: 'VENDA_CONFIRMADA',
          entity: 'orders',
          entityId: orderId,
          newValues: { 
            subtotal: calculatedSubtotal,
            discount: appliedDiscount,
            total: authoritativeTotal, 
            paymentMethod: params.paymentMethod, 
            orderNumber 
          },
          ipAddress: params.ipAddress
        });

        const responsePayload = {
          sucesso: true,
          mensagem: 'Venda processada com sucesso no PostgreSQL!',
          order: {
            orderId: order.orderId,
            tenantId: order.tenantId,
            orderNumber: order.orderNumber,
            subtotal: Number(order.subtotal),
            discount: Number(order.discount),
            total: Number(order.total),
            storeId: order.storeId,
            status: order.status
          }
        };

        // 11. Persistência de Chave de Idempotência com Fingerprint
        if (idempKey) {
          await tx.insert(idempotencyKeys).values({
            key: idempKey,
            tenantId: params.tenantId,
            storeId: params.storeId,
            requestPath: params.requestPath || '/api/vendas',
            fingerprint: params.fingerprint,
            statusCode: 201,
            responseBody: responsePayload
          });
        }

        return {
          isIdempotentReplay: false,
          data: responsePayload
        };
      });
    } catch (error: any) {
      if (error instanceof IdempotencyConflictError || error?.statusCode === 409) {
        throw error;
      }

      const pgCode = error?.code || error?.cause?.code;
      const isDuplicateIdemp = 
        (pgCode === '23505' || String(error?.message || '').includes('idempotency_keys') || String(error?.cause?.message || '').includes('idempotency_keys')) && 
        Boolean(idempKey);

      // Proteção de Idempotência Concorrente (código 23505 = violação de UNIQUE no PostgreSQL)
      if (isDuplicateIdemp) {
        for (let attempt = 0; attempt < 20; attempt++) {
          await new Promise(r => setTimeout(r, 60));
          const existingKey = await db.select().from(idempotencyKeys)
            .where(and(
              eq(idempotencyKeys.key, idempKey!),
              eq(idempotencyKeys.tenantId, params.tenantId)
            ));

          if (existingKey.length > 0) {
            const record = existingKey[0];
            if (record.fingerprint && params.fingerprint && record.fingerprint !== params.fingerprint) {
              throw new IdempotencyConflictError();
            }
            return {
              isIdempotentReplay: true,
              data: record.responseBody,
              statusCode: record.statusCode || 200
            };
          }
        }
      }

      throw error;
    }
  },

  // Validação Segura de PIN de Supervisor com Auditoria e Proteção contra Brute Force
  async verifySupervisorPin(params: {
    tenantId: string;
    pin: string;
    storeId?: string;
    operatorId: string;
    operatorName: string;
    ipAddress?: string;
  }) {
    // 1. Verificação prévia de bloqueio temporário (Rate Limiting de PIN no PostgreSQL)
    const check = await SupervisorPinProtection.checkBlocked(params.tenantId, params.operatorId, params.ipAddress);
    if (check.isUnavailable) {
      return {
        authorized: false,
        isUnavailable: true,
        statusCode: 503,
        error: 'Serviço de segurança temporariamente indisponível. Tente novamente.'
      };
    }
    if (check.isBlocked) {
      return {
        authorized: false,
        isRateLimited: true,
        statusCode: 429,
        retryAfterSeconds: check.retryAfterSeconds,
        error: `Muitas tentativas inválidas de PIN de supervisor. Acesso temporariamente bloqueado por segurança. Tente novamente em ${check.retryAfterSeconds} segundos.`
      };
    }

    // Busca supervisores (ADMINISTRADOR ou GERENTE) do mesmo tenant
    const supervisors = await db.select().from(users)
      .where(and(
        eq(users.tenantId, params.tenantId),
        eq(users.active, true),
        inArray(users.role, ['SUPER_ADMIN', 'ADMINISTRADOR', 'GERENTE'])
      ));

    // Validação estrita com algoritmo scrypt e salt individual (sem suporte a texto puro ou senhas em log)
    const matching = supervisors.find(s => {
      if (!s.pinHash) return false;
      const pinMatches = verifyPinScrypt(params.pin.trim(), s.pinHash);
      if (!pinMatches) return false;

      // Regra de escopo: GERENTE só pode supervisionar a sua própria unidade vinculada (storeId)
      if (s.role === 'GERENTE') {
        if (!params.storeId || s.storeId !== params.storeId) {
          return false;
        }
      }

      // ADMINISTRADOR e SUPER_ADMIN autorizam dentro do tenant verificado
      return true;
    });

    if (matching) {
      // PIN válido: reseta contador de tentativas falhas (Fail-closed se persistência falhar)
      try {
        await SupervisorPinProtection.resetFailures(params.tenantId, params.operatorId, params.ipAddress);
      } catch (resetError) {
        console.error('[verifySupervisorPin] Erro de infraestrutura ao persistir reset de PIN:', resetError);
        return {
          authorized: false,
          isUnavailable: true,
          statusCode: 503,
          error: 'Serviço de segurança temporariamente indisponível. Tente novamente.'
        };
      }

      await db.insert(auditLogs).values({
        tenantId: params.tenantId,
        storeId: params.storeId || null,
        userId: params.operatorId,
        userName: params.operatorName,
        action: 'AUTORIZACAO_SUPERVISOR_SUCESSO',
        entity: 'supervisor_auth',
        entityId: matching.uid,
        newValues: { supervisorName: matching.name, supervisorRole: matching.role },
        ipAddress: params.ipAddress
      });

      return {
        authorized: true,
        supervisor: {
          uid: matching.uid,
          name: matching.name,
          role: matching.role
        }
      };
    } else {
      // PIN inválido: computa falha e verifica se atingiu limite para bloqueio (Fail-closed se gravação falhar)
      const failureResult = await SupervisorPinProtection.recordFailure(params.tenantId, params.operatorId, params.ipAddress);

      if (failureResult.isUnavailable) {
        return {
          authorized: false,
          isUnavailable: true,
          statusCode: 503,
          error: 'Serviço de segurança temporariamente indisponível. Tente novamente.'
        };
      }

      if (failureResult.isNowBlocked) {
        // Registra bloqueio por brute force nos logs de auditoria
        await db.insert(auditLogs).values({
          tenantId: params.tenantId,
          storeId: params.storeId || null,
          userId: params.operatorId,
          userName: params.operatorName,
          action: 'BLOQUEIO_BRUTE_FORCE_PIN',
          entity: 'supervisor_auth',
          entityId: params.operatorId,
          newValues: {
            ipAddress: params.ipAddress,
            tentativasFalhas: failureResult.failures,
            bloqueadoPorSegundos: failureResult.retryAfterSeconds
          },
          ipAddress: params.ipAddress
        });

        return {
          authorized: false,
          isRateLimited: true,
          statusCode: 429,
          retryAfterSeconds: failureResult.retryAfterSeconds,
          error: `Muitas tentativas inválidas de PIN de supervisor. Acesso temporariamente bloqueado por segurança. Tente novamente em ${failureResult.retryAfterSeconds} segundos.`
        };
      }

      await db.insert(auditLogs).values({
        tenantId: params.tenantId,
        storeId: params.storeId || null,
        userId: params.operatorId,
        userName: params.operatorName,
        action: 'AUTORIZACAO_SUPERVISOR_FALHA',
        entity: 'supervisor_auth',
        entityId: 'invalid-attempt',
        newValues: { attemptedAt: new Date().toISOString(), tentativa: failureResult.failures },
        ipAddress: params.ipAddress
      });

      return {
        authorized: false,
        isRateLimited: false,
        error: 'Autorização não permitida.'
      };
    }
  },

  // Auditoria
  async getAuditLogs(storeId: string | undefined, tenantId: string, limit = 50) {
    if (storeId && storeId !== 'todas') {
      return await db.select().from(auditLogs)
        .where(and(eq(auditLogs.storeId, storeId), eq(auditLogs.tenantId, tenantId)))
        .orderBy(desc(auditLogs.timestamp))
        .limit(limit);
    }
    return await db.select().from(auditLogs)
      .where(eq(auditLogs.tenantId, tenantId))
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit);
  },

  // Usuários do Tenant
  async getUsers(tenantId: string) {
    return await db.select().from(users).where(eq(users.tenantId, tenantId));
  },

  // ============================================================================
  // GESTÃO SEGURA DE FUNCIONÁRIOS COM PERFIL OPERADOR E CONVITES (FASE 2)
  // ============================================================================

  /**
   * Lista todos os funcionários com perfil OPERADOR vinculados ao tenant
   */
  async getEmployees(tenantId: string) {
    const employeeUsers = await db.select().from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.role, 'OPERADOR')))
      .orderBy(desc(users.createdAt));

    const tenantStores = await db.select().from(stores).where(eq(stores.tenantId, tenantId));
    const storeMap = new Map<string, string>();
    for (const s of tenantStores) {
      storeMap.set(s.storeId, s.tradeName || s.corporateName || s.name || s.storeId);
    }

    // Buscar convites mais recentes do tenant
    const invitations = await db.select().from(userInvitations)
      .where(and(eq(userInvitations.tenantId, tenantId), eq(userInvitations.role, 'OPERADOR')))
      .orderBy(desc(userInvitations.createdAt));

    const now = new Date();
    return employeeUsers.map(u => {
      const latestInv = invitations.find(inv => inv.email.toLowerCase() === u.email.toLowerCase());
      let conviteStatus: 'PENDENTE' | 'ACEITO' | 'EXPIRADO' | 'NAO_ENVIADO' = 'NAO_ENVIADO';
      if (latestInv) {
        if (latestInv.acceptedAt) {
          conviteStatus = 'ACEITO';
        } else if (new Date(latestInv.expiresAt) < now) {
          conviteStatus = 'EXPIRADO';
        } else {
          conviteStatus = 'PENDENTE';
        }
      }

      return {
        id: u.uid,
        nome: u.name,
        email: u.email,
        role: u.role, // Sempre 'OPERADOR'
        lojaId: u.storeId,
        lojaNome: u.storeId ? (storeMap.get(u.storeId) || u.storeId) : 'Não vinculada',
        status: u.status || (u.active ? 'ACTIVE' : 'INACTIVE'),
        active: u.active,
        createdAt: u.createdAt,
        convite: latestInv ? {
          invitationId: latestInv.invitationId,
          status: conviteStatus,
          expiresAt: latestInv.expiresAt,
          acceptedAt: latestInv.acceptedAt
        } : null
      };
    });
  },

  /**
   * Cria um novo funcionário estritamente com perfil OPERADOR e gera convite
   */
  async createOperatorEmployee(params: {
    tenantId: string;
    storeId: string;
    name: string;
    email: string;
    status?: 'ACTIVE' | 'INACTIVE';
    createdByUserId: string;
    createdByUserName: string;
    ipAddress?: string;
    appUrl?: string;
  }) {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanName = params.name.trim();

    // 1. Validação de isolamento: Loja deve existir e pertencer estritamente a este tenant
    const store = await PosRepository.getStoreById(params.storeId, params.tenantId);
    if (!store) {
      throw new Error('A loja informada não existe ou não pertence a esta empresa.');
    }

    // 2. Validação de duplicidade: não permitir mesmo e-mail no mesmo tenant
    const [existing] = await db.select().from(users).where(
      and(eq(users.tenantId, params.tenantId), eq(users.email, cleanEmail))
    );
    if (existing) {
      throw new Error('Já existe um funcionário ou usuário cadastrado com este e-mail nesta empresa.');
    }

    // 3. Status e Flags
    const initialStatus = params.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const isActive = initialStatus !== 'INACTIVE';
    const newUid = `usr-op-${crypto.randomBytes(8).toString('hex')}`;

    // 4. Inserção do usuário (OBRIGATORIAMENTE role = 'OPERADOR')
    const [createdUser] = await db.insert(users).values({
      uid: newUid,
      tenantId: params.tenantId,
      storeId: params.storeId,
      name: cleanName,
      email: cleanEmail,
      role: 'OPERADOR', // INVARIANTE ABSOLUTA: Sempre OPERADOR
      status: initialStatus,
      active: isActive
    }).returning();

    // 5. Geração do token criptográfico de convite
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const invitationId = `inv-${crypto.randomBytes(8).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias

    await db.insert(userInvitations).values({
      invitationId,
      tenantId: params.tenantId,
      storeId: params.storeId,
      email: cleanEmail,
      role: 'OPERADOR', // Convite sempre OPERADOR
      tokenHash,
      expiresAt,
      createdBy: params.createdByUserId
    });

    // 6. Registro em Log de Auditoria Imutável (CRIACAO_FUNCIONARIO_OPERADOR)
    await db.insert(auditLogs).values({
      tenantId: params.tenantId,
      storeId: params.storeId,
      userId: params.createdByUserId,
      userName: params.createdByUserName,
      action: 'CRIACAO_FUNCIONARIO_OPERADOR',
      entity: 'users',
      entityId: newUid,
      newValues: {
        nome: cleanName,
        email: cleanEmail,
        lojaId: params.storeId,
        role: 'OPERADOR',
        status: initialStatus,
        invitationId
      },
      ipAddress: params.ipAddress || null
    });

    const baseUrl = params.appUrl || '';
    const conviteLink = `${baseUrl}?convite=${rawToken}`;

    return {
      id: createdUser.uid,
      nome: createdUser.name,
      email: createdUser.email,
      role: createdUser.role,
      lojaId: createdUser.storeId,
      lojaNome: store.tradeName || store.corporateName || store.name || store.storeId,
      status: createdUser.status,
      active: createdUser.active,
      createdAt: createdUser.createdAt,
      convite: {
        invitationId,
        token: rawToken,
        conviteLink,
        expiresAt
      }
    };
  },

  /**
   * Ativa ou desativa um funcionário (apenas perfil OPERADOR)
   */
  async updateEmployeeStatus(params: {
    tenantId: string;
    employeeId: string;
    status: 'ACTIVE' | 'INACTIVE';
    updatedByUserId: string;
    updatedByUserName: string;
    ipAddress?: string;
  }) {
    // 1. Busca usuário garantindo tenantId
    const [emp] = await db.select().from(users).where(
      and(eq(users.tenantId, params.tenantId), eq(users.uid, params.employeeId))
    );

    if (!emp) {
      throw new Error('Funcionário não encontrado nesta empresa.');
    }

    // 2. Proteção: apenas funcionários com role OPERADOR podem ser alterados por este método
    if (emp.role !== 'OPERADOR') {
      throw new Error('Operação negada: Apenas funcionários com perfil OPERADOR podem ser gerenciados neste fluxo.');
    }

    const isActive = params.status === 'ACTIVE';
    const [updated] = await db.update(users).set({
      status: params.status,
      active: isActive,
      updatedAt: new Date()
    }).where(and(eq(users.tenantId, params.tenantId), eq(users.uid, params.employeeId))).returning();

    // 3. Log de auditoria
    const actionName = isActive ? 'ATIVACAO_FUNCIONARIO_OPERADOR' : 'DESATIVACAO_FUNCIONARIO_OPERADOR';
    await db.insert(auditLogs).values({
      tenantId: params.tenantId,
      storeId: emp.storeId,
      userId: params.updatedByUserId,
      userName: params.updatedByUserName,
      action: actionName,
      entity: 'users',
      entityId: emp.uid,
      oldValues: { status: emp.status, active: emp.active },
      newValues: { status: params.status, active: isActive },
      ipAddress: params.ipAddress || null
    });

    return {
      id: updated.uid,
      nome: updated.name,
      email: updated.email,
      role: updated.role,
      lojaId: updated.storeId,
      status: updated.status,
      active: updated.active
    };
  },

  /**
   * Vincula ou altera a loja de um funcionário OPERADOR
   */
  async updateEmployeeStore(params: {
    tenantId: string;
    employeeId: string;
    storeId: string;
    updatedByUserId: string;
    updatedByUserName: string;
    ipAddress?: string;
  }) {
    // 1. Valida se a loja destino existe e pertence ao mesmo tenant
    const store = await PosRepository.getStoreById(params.storeId, params.tenantId);
    if (!store) {
      throw new Error('A loja informada não existe ou não pertence a este estabelecimento.');
    }

    // 2. Valida usuário no tenant
    const [emp] = await db.select().from(users).where(
      and(eq(users.tenantId, params.tenantId), eq(users.uid, params.employeeId))
    );

    if (!emp) {
      throw new Error('Funcionário não encontrado nesta empresa.');
    }

    if (emp.role !== 'OPERADOR') {
      throw new Error('Operação negada: Apenas funcionários com perfil OPERADOR podem ter a loja alterada neste fluxo.');
    }

    const [updated] = await db.update(users).set({
      storeId: params.storeId,
      updatedAt: new Date()
    }).where(and(eq(users.tenantId, params.tenantId), eq(users.uid, params.employeeId))).returning();

    // 3. Log de auditoria
    await db.insert(auditLogs).values({
      tenantId: params.tenantId,
      storeId: params.storeId,
      userId: params.updatedByUserId,
      userName: params.updatedByUserName,
      action: 'VINCULACAO_LOJA_FUNCIONARIO',
      entity: 'users',
      entityId: emp.uid,
      oldValues: { storeId: emp.storeId },
      newValues: { storeId: params.storeId },
      ipAddress: params.ipAddress || null
    });

    return {
      id: updated.uid,
      nome: updated.name,
      email: updated.email,
      role: updated.role,
      lojaId: updated.storeId,
      lojaNome: store.tradeName || store.corporateName || store.name || store.storeId,
      status: updated.status,
      active: updated.active
    };
  },

  /**
   * Gera novo convite para um funcionário existente
   */
  async resendEmployeeInvitation(params: {
    tenantId: string;
    employeeId: string;
    createdByUserId: string;
    createdByUserName: string;
    ipAddress?: string;
    appUrl?: string;
  }) {
    const [emp] = await db.select().from(users).where(
      and(eq(users.tenantId, params.tenantId), eq(users.uid, params.employeeId))
    );

    if (!emp) {
      throw new Error('Funcionário não encontrado.');
    }

    if (emp.role !== 'OPERADOR') {
      throw new Error('Apenas funcionários OPERADOR podem receber convite por este fluxo.');
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const invitationId = `inv-${crypto.randomBytes(8).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(userInvitations).values({
      invitationId,
      tenantId: params.tenantId,
      storeId: emp.storeId,
      email: emp.email,
      role: 'OPERADOR',
      tokenHash,
      expiresAt,
      createdBy: params.createdByUserId
    });

    await db.insert(auditLogs).values({
      tenantId: params.tenantId,
      storeId: emp.storeId,
      userId: params.createdByUserId,
      userName: params.createdByUserName,
      action: 'REENVIO_CONVITE_FUNCIONARIO',
      entity: 'user_invitations',
      entityId: invitationId,
      newValues: { email: emp.email, employeeId: emp.uid },
      ipAddress: params.ipAddress || null
    });

    const baseUrl = params.appUrl || '';
    const conviteLink = `${baseUrl}?convite=${rawToken}`;

    return {
      invitationId,
      token: rawToken,
      conviteLink,
      expiresAt
    };
  },

  /**
   * Consulta dados públicos/seguros de um convite a partir do token
   */
  async getInvitationByToken(rawToken: string) {
    if (!rawToken || typeof rawToken !== 'string') return null;
    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

    const [inv] = await db.select().from(userInvitations).where(eq(userInvitations.tokenHash, tokenHash));
    if (!inv) return null;

    const [tenant] = await db.select().from(tenants).where(eq(tenants.tenantId, inv.tenantId));
    const store = inv.storeId ? await PosRepository.getStoreById(inv.storeId, inv.tenantId) : null;

    const [userRecord] = await db.select().from(users).where(
      and(eq(users.tenantId, inv.tenantId), eq(users.email, inv.email))
    );

    const isExpired = new Date(inv.expiresAt) < new Date();

    return {
      invitationId: inv.invitationId,
      email: inv.email,
      nome: userRecord?.name || '',
      role: inv.role, // 'OPERADOR'
      tenantId: inv.tenantId,
      tenantNome: tenant?.tradeName || tenant?.name || 'Estabelecimento',
      storeId: inv.storeId,
      storeNome: store ? (store.tradeName || store.corporateName || store.name || store.storeId) : 'Loja Designada',
      isExpired,
      isAccepted: !!inv.acceptedAt,
      expiresAt: inv.expiresAt
    };
  },

  /**
   * Aceita o convite e define o PIN de acesso do operador (se fornecido)
   */
  async acceptEmployeeInvitation(rawToken: string, pin?: string, name?: string) {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new Error('Token de convite inválido.');
    }
    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

    const [inv] = await db.select().from(userInvitations).where(eq(userInvitations.tokenHash, tokenHash));
    if (!inv) {
      throw new Error('Convite não encontrado ou token inválido.');
    }

    if (inv.acceptedAt) {
      throw new Error('Este convite já foi aceito anteriormente.');
    }

    if (new Date(inv.expiresAt) < new Date()) {
      throw new Error('Este convite expirou. Solicite um novo link ao administrador.');
    }

    // Busca o usuário associado
    const [userRecord] = await db.select().from(users).where(
      and(eq(users.tenantId, inv.tenantId), eq(users.email, inv.email))
    );

    if (!userRecord) {
      throw new Error('Registro de usuário não encontrado para este convite.');
    }

    const updates: Record<string, any> = {
      status: 'ACTIVE',
      active: true,
      updatedAt: new Date()
    };

    if (pin && pin.trim().length >= 4) {
      updates.pinHash = hashPinScrypt(pin.trim());
    }

    if (name && name.trim().length >= 2) {
      updates.name = name.trim();
    }

    await db.update(users).set(updates).where(eq(users.uid, userRecord.uid));

    // Marca convite como aceito
    await db.update(userInvitations).set({
      acceptedAt: new Date()
    }).where(eq(userInvitations.id, inv.id));

    // Auditoria
    await db.insert(auditLogs).values({
      tenantId: inv.tenantId,
      storeId: inv.storeId,
      userId: userRecord.uid,
      userName: userRecord.name,
      action: 'ACEITE_CONVITE_FUNCIONARIO',
      entity: 'user_invitations',
      entityId: inv.invitationId,
      newValues: { email: inv.email, role: 'OPERADOR', status: 'ACTIVE' }
    });

    return {
      sucesso: true,
      userId: userRecord.uid,
      nome: updates.name || userRecord.name,
      email: userRecord.email,
      role: userRecord.role,
      storeId: userRecord.storeId
    };
  }
};

