import { Injectable } from '@nestjs/common';
import { db } from '../../database/db';
import { auditLogs } from '../../database/schema';
import { getClientIp } from '../../common/utils/security';

@Injectable()
export class AuditService {
  /**
   * Registrar uma ação no log de auditoria
   * CRÍTICO: Todo acesso ao sistema passa aqui
   */
  async log(
    tenantId: string,
    storeId: string | null,
    userId: string,
    userName: string,
    action: string,
    entity: string,
    entityId: string,
    oldValues: Record<string, any> | null,
    newValues: Record<string, any> | null,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      await db.insert(auditLogs).values({
        tenantId,
        storeId,
        userId,
        userName,
        action,
        entity,
        entityId,
        oldValues: oldValues ? JSON.stringify(oldValues) : null,
        newValues: newValues ? JSON.stringify(newValues) : null,
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown',
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Erro ao registrar auditoria:', error);
      // Não lançar erro, apenas log
    }
  }

  /**
   * Buscar histórico de auditoria com filtros
   */
  async getAuditLogs(
    tenantId: string,
    filters?: {
      storeId?: string;
      userId?: string;
      action?: string;
      entity?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    },
  ) {
    const limit = filters?.limit || 100;
    const offset = filters?.offset || 0;

    const where = [];
    where.push(eq(auditLogs.tenantId, tenantId));

    if (filters?.storeId) where.push(eq(auditLogs.storeId, filters.storeId));
    if (filters?.userId) where.push(eq(auditLogs.userId, filters.userId));
    if (filters?.action) where.push(eq(auditLogs.action, filters.action));
    if (filters?.entity) where.push(eq(auditLogs.entity, filters.entity));

    if (filters?.startDate) {
      where.push(gte(auditLogs.timestamp, filters.startDate));
    }

    if (filters?.endDate) {
      where.push(lte(auditLogs.timestamp, filters.endDate));
    }

    const logs = await db.query.auditLogs.findMany({
      where: where.length > 0 ? and(...where) : undefined,
      orderBy: (logs, { desc }) => desc(logs.timestamp),
      limit,
      offset,
    });

    return logs;
  }

  /**
   * Contar registros de auditoria (para paginação)
   */
  async countAuditLogs(tenantId: string, storeId?: string) {
    const logs = await db.query.auditLogs.findMany({
      where: storeId
        ? and(eq(auditLogs.tenantId, tenantId), eq(auditLogs.storeId, storeId))
        : eq(auditLogs.tenantId, tenantId),
    });

    return logs.length;
  }

  /**
   * Exportar logs para PDF/Excel (retorna dados para serem processados)
   */
  async exportAuditLogs(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const logs = await db.query.auditLogs.findMany({
      where: and(
        eq(auditLogs.tenantId, tenantId),
        gte(auditLogs.timestamp, startDate),
        lte(auditLogs.timestamp, endDate),
      ),
      orderBy: (logs, { desc }) => desc(logs.timestamp),
    });

    return logs.map((log) => ({
      timestamp: log.timestamp,
      userId: log.userId,
      userName: log.userName,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      storeId: log.storeId,
      oldValues: log.oldValues ? JSON.parse(log.oldValues) : null,
      newValues: log.newValues ? JSON.parse(log.newValues) : null,
      ipAddress: log.ipAddress,
    }));
  }
}

// Fix imports
import { eq, and, gte, lte } from 'drizzle-orm';
