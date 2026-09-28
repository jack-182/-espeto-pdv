import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { db } from '../../database/db';
import { cashSessions, cashMovements, auditLogs } from '../../database/schema';
import { eq, and } from 'drizzle-orm';
import { AlertService } from './alerts/alert.service';
import { AuditService } from '../audit/audit.service';
import { NotificationGateway } from '../notifications/notification.gateway';
import { v4 as uuidv4 } from 'uuid';
import { Decimal } from 'decimal.js';

export interface CloseCashSessionDto {
  declaredCash: number;
  declaredPix: number;
  declaredCard: number;
  notes?: string;
}

export interface CashSessionResponse {
  sessionId: string;
  status: string;
  desvio: {
    cash: number;
    pix: number;
    card: number;
    total: number;
    percentual: number;
  };
  alertCreated: boolean;
  closedAt: Date;
}

@Injectable()
export class CashService {
  constructor(
    private alertService: AlertService,
    private auditService: AuditService,
    private notificationGateway: NotificationGateway,
  ) {}

  /**
   * Abre uma nova sessão de caixa
   */
  async openCashSession(
    tenantId: string,
    storeId: string,
    terminalId: string,
    operatorId: string,
    operatorName: string,
    initialFund: number,
  ) {
    try {
      const sessionId = `session-${uuidv4()}`;
      const sessionNumber = await this.getNextSessionNumber(storeId);

      await db.insert(cashSessions).values({
        sessionId,
        tenantId,
        storeId,
        terminalId,
        sessionNumber,
        operatorId,
        operatorName,
        initialFund: new Decimal(initialFund).toFixed(2),
        status: 'ABERTO',
      });

      // Log auditoria
      await this.auditService.log(
        tenantId,
        storeId,
        operatorId,
        operatorName,
        'ABERTURA_CAIXA',
        'cash_sessions',
        sessionId,
        null,
        { initialFund },
      );

      return {
        sessionId,
        status: 'ABERTO',
        initialFund,
        openedAt: new Date(),
      };
    } catch (error) {
      throw new BadRequestException(`Erro ao abrir caixa: ${error.message}`);
    }
  }

  /**
   * Fecha uma sessão de caixa e detecta desvios
   * CRÍTICO: Aqui acontece a mágica do sistema de alertas
   */
  async closeCashSession(
    tenantId: string,
    storeId: string,
    sessionId: string,
    operatorId: string,
    operatorName: string,
    dto: CloseCashSessionDto,
  ): Promise<CashSessionResponse> {
    try {
      // 1. Buscar sessão com validação de isolamento multi-tenant
      const session = await db.query.cashSessions.findFirst({
        where: and(
          eq(cashSessions.sessionId, sessionId),
          eq(cashSessions.tenantId, tenantId),
          eq(cashSessions.storeId, storeId),
        ),
      });

      if (!session) {
        throw new ForbiddenException('Sessão de caixa não encontrada');
      }

      if (session.status !== 'ABERTO') {
        throw new BadRequestException(`Caixa não está aberto. Status: ${session.status}`);
      }

      // 2. Calcular totais do sistema (do banco de dados)
      const systemTotals = await this.calculateSystemTotals(tenantId, storeId, sessionId);

      // 3. Calcular desvios
      const desvios = this.calculateDeviations(
        {
          cash: parseFloat(dto.declaredCash.toString()),
          pix: parseFloat(dto.declaredPix.toString()),
          card: parseFloat(dto.declaredCard.toString()),
        },
        systemTotals,
      );

      // 4. Atualizar sessão com valores declarados e diferenças
      const closedAt = new Date();
      await db
        .update(cashSessions)
        .set({
          declaredCash: new Decimal(dto.declaredCash).toFixed(2),
          declaredPix: new Decimal(dto.declaredPix).toFixed(2),
          declaredCard: new Decimal(dto.declaredCard).toFixed(2),
          cashDifference: new Decimal(desvios.total).toFixed(2),
          status: 'FECHADO',
          closedAt,
          notes: dto.notes,
        })
        .where(
          and(
            eq(cashSessions.sessionId, sessionId),
            eq(cashSessions.tenantId, tenantId),
          ),
        );

      // 5. Log auditoria
      await this.auditService.log(
        tenantId,
        storeId,
        operatorId,
        operatorName,
        'FECHAMENTO_CAIXA',
        'cash_sessions',
        sessionId,
        {
          status: session.status,
          declaredCash: session.declaredCash,
        },
        {
          status: 'FECHADO',
          declaredCash: dto.declaredCash,
          desvio: desvios.total,
        },
      );

      // 6. CRIAR ALERTA SE DESVIO ACIMA DO THRESHOLD (5%)
      let alertCreated = false;
      if (desvios.percentual > 5) {
        await this.alertService.createAlert(
          tenantId,
          storeId,
          'DESVIO_CAIXA',
          'CRITICO',
          `Desvio de ${desvios.percentual.toFixed(2)}% detectado`,
          {
            sessionId,
            desvio: desvios.total,
            percentual: desvios.percentual,
            declaredCash: dto.declaredCash,
            systemCash: systemTotals.cash,
            operator: operatorName,
          },
        );

        alertCreated = true;

        // Notificar dono em tempo real via WebSocket
        this.notificationGateway.broadcastToOwner(tenantId, {
          type: 'ALERTA_DESVIO',
          level: 'CRITICO',
          title: '🚨 Desvio de Caixa Detectado',
          message: `Loja: ${storeId} | Desvio: R$ ${desvios.total.toFixed(2)} (${desvios.percentual.toFixed(2)}%)`,
          storeId,
          sessionId,
          desvios,
          timestamp: new Date(),
        });
      }

      return {
        sessionId,
        status: 'FECHADO',
        desvio: desvios,
        alertCreated,
        closedAt,
      };
    } catch (error) {
      throw new BadRequestException(`Erro ao fechar caixa: ${error.message}`);
    }
  }

  /**
   * Calcular totais do sistema (soma de todas as vendas + sangrias + suprimentos)
   */
  private async calculateSystemTotals(
    tenantId: string,
    storeId: string,
    sessionId: string,
  ) {
    // Buscar todas as vendas pagadas nesta sessão
    const payments = await db.query.payments.findMany({
      where: and(
        eq(payments.tenantId, tenantId),
        eq(payments.storeId, storeId),
        eq(payments.sessionId, sessionId),
        eq(payments.status, 'CONFIRMED'),
      ),
    });

    // Agrupar por método de pagamento
    let cash = 0;
    let pix = 0;
    let card = 0;

    payments.forEach((payment) => {
      const amount = parseFloat(payment.amount.toString());
      if (payment.method === 'DINHEIRO') cash += amount;
      if (payment.method === 'PIX') pix += amount;
      if (payment.method === 'CARTAO_DEBITO' || payment.method === 'CARTAO_CREDITO')
        card += amount;
    });

    // Buscar movimentações (sangria, suprimento)
    const movements = await db.query.cashMovements.findMany({
      where: and(
        eq(cashMovements.tenantId, tenantId),
        eq(cashMovements.sessionId, sessionId),
      ),
    });

    movements.forEach((mov) => {
      const amount = parseFloat(mov.amount.toString());
      if (mov.type === 'SANGRIA' && mov.paymentMethod === 'DINHEIRO') cash -= amount;
      if (mov.type === 'SUPRIMENTO' && mov.paymentMethod === 'DINHEIRO') cash += amount;
    });

    return { cash, pix, card };
  }

  /**
   * Calcular desvios (diferença entre declarado vs sistema)
   */
  private calculateDeviations(
    declared: { cash: number; pix: number; card: number },
    system: { cash: number; pix: number; card: number },
  ) {
    const desvios = {
      cash: Math.abs(declared.cash - system.cash),
      pix: Math.abs(declared.pix - system.pix),
      card: Math.abs(declared.card - system.card),
      total: 0,
      percentual: 0,
    };

    desvios.total =
      desvios.cash + desvios.pix + desvios.card;

    // Calcular percentual em relação ao total do sistema
    const totalSystem =
      system.cash + system.pix + system.card;

    if (totalSystem > 0) {
      desvios.percentual = (desvios.total / totalSystem) * 100;
    }

    return desvios;
  }

  /**
   * Buscar número da próxima sessão
   */
  private async getNextSessionNumber(storeId: string): Promise<number> {
    const lastSession = await db.query.cashSessions.findFirst({
      where: eq(cashSessions.storeId, storeId),
      orderBy: (sessions, { desc }) => desc(sessions.sessionNumber),
    });

    return (lastSession?.sessionNumber ?? 0) + 1;
  }

  /**
   * Listar sessões de caixa
   */
  async listCashSessions(
    tenantId: string,
    storeId: string,
    filters?: {
      status?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const limit = filters?.limit || 10;
    const offset = filters?.offset || 0;

    const sessions = await db.query.cashSessions.findMany({
      where: and(
        eq(cashSessions.tenantId, tenantId),
        eq(cashSessions.storeId, storeId),
        filters?.status ? eq(cashSessions.status, filters.status) : undefined,
      ),
      orderBy: (sessions, { desc }) => desc(sessions.openedAt),
      limit,
      offset,
    });

    return sessions;
  }

  /**
   * Buscar uma sessão específica
   */
  async getCashSessionById(
    tenantId: string,
    storeId: string,
    sessionId: string,
  ) {
    return await db.query.cashSessions.findFirst({
      where: and(
        eq(cashSessions.sessionId, sessionId),
        eq(cashSessions.tenantId, tenantId),
        eq(cashSessions.storeId, storeId),
      ),
    });
  }
}
