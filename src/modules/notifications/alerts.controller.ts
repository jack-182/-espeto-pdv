import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { AlertService } from '../cash/alerts/alert.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WhatsAppService } from '../../services/whatsapp.service';

@Controller('api/v1/alerts')
@UseGuards(JwtGuard, TenantGuard, RbacGuard)
export class AlertsController {
  constructor(
    private alertService: AlertService,
    private whatsappService: WhatsAppService,
  ) {}

  /**
   * GET /api/v1/alerts
   * Listar alertas pendentes (não lidos)
   */
  @Get()
  @RequireRole(['OWNER', 'ADMIN', 'MANAGER', 'VIEWER'])
  async getAlerts(@CurrentTenant() tenant: { tenantId: string; storeId: string }) {
    return await this.alertService.getPendingAlerts(
      tenant.tenantId,
      tenant.storeId,
    );
  }

  /**
   * POST /api/v1/alerts/:id/read
   * Marcar alerta como lido
   */
  @Post(':id/read')
  @RequireRole(['OWNER', 'ADMIN', 'MANAGER', 'VIEWER'])
  @HttpCode(HttpStatus.OK)
  async markAlertAsRead(
    @CurrentTenant() tenant: { tenantId: string },
    @Param('id') alertId: string,
  ) {
    await this.alertService.markAsRead(tenant.tenantId, alertId);
    return { success: true };
  }

  /**
   * GET /api/v1/alerts/critical/count
   * Contar alertas críticos não lidos
   */
  @Get('critical/count')
  @RequireRole(['OWNER', 'ADMIN', 'MANAGER'])
  async getCriticalCount(@CurrentTenant() tenant: { tenantId: string }) {
    const count = await this.alertService.getCriticalAlertsCount(
      tenant.tenantId,
    );
    return { count };
  }

  /**
   * POST /api/v1/alerts/test-whatsapp
   * Testar conexão WhatsApp (ADMIN only)
   *
   * Útil para validar que Twilio está configurado e funcionando
   */
  @Post('test-whatsapp')
  @RequireRole(['OWNER', 'ADMIN'])
  @HttpCode(HttpStatus.OK)
  async testWhatsApp(
    @Body() body: { phoneNumber: string },
  ) {
    const success = await this.whatsappService.testConnection(body.phoneNumber);

    return {
      success,
      message: success
        ? '✅ WhatsApp funcionando! Mensagem de teste foi enviada.'
        : '❌ Falha ao enviar. Verificar credenciais Twilio.',
      isConfigured: this.whatsappService.isConfigured(),
    };
  }

  /**
   * POST /api/v1/alerts/manual
   * Disparar alerta manual (para testes)
   */
  @Post('manual')
  @RequireRole(['OWNER', 'ADMIN'])
  @HttpCode(HttpStatus.CREATED)
  async createManualAlert(
    @CurrentTenant() tenant: { tenantId: string; storeId: string },
    @CurrentUser() user: { uid: string; name: string },
    @Body()
    body: {
      type: string;
      level: string;
      message: string;
      details?: Record<string, any>;
    },
  ) {
    return await this.alertService.createAlert(
      tenant.tenantId,
      tenant.storeId,
      body.type,
      body.level,
      body.message,
      body.details || {},
    );
  }
}
