import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../../database/db';
import { notifications, users, stores } from '../../../database/schema';
import { v4 as uuidv4 } from 'uuid';
import { WhatsAppService } from '../../../services/whatsapp.service';
import { eq, and } from 'drizzle-orm';

export interface CreateAlertDto {
  type: string; // 'DESVIO_CAIXA', 'SANGRIA', 'SUPRIMENTO', 'CANCELAMENTO'
  level: string; // 'NORMAL', 'ATENCAO', 'CRITICO'
  title: string;
  details: Record<string, any>;
}

@Injectable()
export class AlertService {
  private logger = new Logger('AlertService');

  constructor(private whatsappService: WhatsAppService) {}

  /**
   * Criar alerta que será persistido, enviado em tempo real E via WhatsApp
   */
  async createAlert(
    tenantId: string,
    storeId: string,
    type: string,
    level: string,
    message: string,
    details: Record<string, any>,
  ) {
    try {
      const notificationId = `notif-${uuidv4()}`;

      // 1. Persistir notificação no banco
      await db.insert(notifications).values({
        notificationId,
        tenantId,
        storeId,
        type,
        level,
        title: message.substring(0, 200),
        message,
        details: JSON.stringify(details),
        read: false,
        timestamp: new Date(),
      });

      // 2. SE alerta é CRÍTICO, enviar via WhatsApp ao dono
      if (level === 'CRITICO' && this.whatsappService.isConfigured()) {
        this.sendWhatsAppAlertThenOwner(tenantId, storeId, type, message, details).catch(
          (err) => {
            this.logger.error(
              `Erro ao enviar WhatsApp: ${err.message}`,
            );
            // Não falhar se WhatsApp falhar, é apenas notificação extra
          },
        );
      }

      return {
        notificationId,
        type,
        level,
        message,
        createdAt: new Date(),
      };
    } catch (error) {
      this.logger.error('Erro ao criar alerta:', error);
      throw error;
    }
  }

  /**
   * Enviar alerta crítico via WhatsApp ao proprietário (DONO)
   * Executa async para não bloquear resposta da API
   */
  private async sendWhatsAppAlertThenOwner(
    tenantId: string,
    storeId: string,
    type: string,
    message: string,
    details: Record<string, any>,
  ) {
    try {
      // Buscar proprietário (OWNER) do tenant
      const owner = await db.query.users.findFirst({
        where: and(eq(users.tenantId, tenantId), eq(users.role, 'OWNER')),
      });

      if (!owner || !owner.phone) {
        this.logger.warn(`Proprietário do tenant ${tenantId} não tem telefone`);
        return;
      }

      // Buscar nome da loja
      const storeData = await db.query.stores.findFirst({
        where: eq(stores.storeId, storeId),
      });

      const storeName = storeData?.name || storeId;

      // Enviar via WhatsApp
      const result = await this.whatsappService.sendAlert(owner.phone, {
        tenantId,
        storeName,
        alertType: type as any,
        message,
        details,
      });

      if (result.success) {
        this.logger.log(
          `✅ WhatsApp enviado ao dono ${owner.name} (${owner.phone})`,
        );
      } else {
        this.logger.error(`❌ Falha ao enviar WhatsApp: ${result.error}`);
      }
    } catch (error: any) {
      this.logger.error(
        `Erro ao processar envio WhatsApp: ${error.message}`,
      );
    }
  }

  /**
   * Listar alertas pendentes (não lidos)
   */
  async getPendingAlerts(tenantId: string, storeId?: string) {
    const where = storeId
      ? db.query.notifications.findMany({
          where: and(
            eq(notifications.tenantId, tenantId),
            eq(notifications.storeId, storeId),
            eq(notifications.read, false),
          ),
          orderBy: (notif, { desc }) => desc(notif.timestamp),
        })
      : db.query.notifications.findMany({
          where: and(
            eq(notifications.tenantId, tenantId),
            eq(notifications.read, false),
          ),
          orderBy: (notif, { desc }) => desc(notif.timestamp),
        });

    return where;
  }

  /**
   * Marcar notificação como lida
   */
  async markAsRead(tenantId: string, notificationId: string) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.notificationId, notificationId),
          eq(notifications.tenantId, tenantId),
        ),
      );
  }

  /**
   * Contar alertas críticos não lidos
   */
  async getCriticalAlertsCount(tenantId: string) {
    const alerts = await db.query.notifications.findMany({
      where: and(
        eq(notifications.tenantId, tenantId),
        eq(notifications.level, 'CRITICO'),
        eq(notifications.read, false),
      ),
    });

    return alerts.length;
  }
}

// Fix imports
import { eq, and } from 'drizzle-orm';
