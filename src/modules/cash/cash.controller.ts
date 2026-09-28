import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Query,
} from '@nestjs/common';
import { CashService, CloseCashSessionDto } from './cash.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RequireRole } from '../../common/decorators/require-role.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api/v1/cash-sessions')
@UseGuards(JwtGuard, TenantGuard, RbacGuard)
export class CashController {
  constructor(private readonly cashService: CashService) {}

  /**
   * POST /api/v1/cash-sessions
   * Abrir uma nova sessão de caixa
   */
  @Post()
  @RequireRole(['OWNER', 'ADMIN', 'MANAGER', 'CASHIER'])
  @HttpCode(HttpStatus.CREATED)
  async openCashSession(
    @CurrentTenant() tenant: { tenantId: string; storeId: string },
    @CurrentUser() user: { uid: string; name: string },
    @Body()
    body: {
      terminalId?: string;
      initialFund: number;
    },
  ) {
    return await this.cashService.openCashSession(
      tenant.tenantId,
      tenant.storeId,
      body.terminalId,
      user.uid,
      user.name,
      body.initialFund,
    );
  }

  /**
   * POST /api/v1/cash-sessions/:sessionId/close
   * Fechar uma sessão e validar desvios
   *
   * ⚠️ CRITICAL ENDPOINT: Aqui disparamos alertas de desvio
   */
  @Post(':sessionId/close')
  @RequireRole(['OWNER', 'ADMIN', 'MANAGER', 'CASHIER'])
  @HttpCode(HttpStatus.OK)
  async closeCashSession(
    @CurrentTenant() tenant: { tenantId: string; storeId: string },
    @CurrentUser() user: { uid: string; name: string },
    @Param('sessionId') sessionId: string,
    @Body() body: CloseCashSessionDto,
  ) {
    return await this.cashService.closeCashSession(
      tenant.tenantId,
      tenant.storeId,
      sessionId,
      user.uid,
      user.name,
      body,
    );
  }

  /**
   * GET /api/v1/cash-sessions
   * Listar sessões de caixa
   */
  @Get()
  @RequireRole(['OWNER', 'ADMIN', 'MANAGER', 'VIEWER'])
  async listCashSessions(
    @CurrentTenant() tenant: { tenantId: string; storeId: string },
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return await this.cashService.listCashSessions(tenant.tenantId, tenant.storeId, {
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  /**
   * GET /api/v1/cash-sessions/:sessionId
   * Buscar uma sessão específica
   */
  @Get(':sessionId')
  @RequireRole(['OWNER', 'ADMIN', 'MANAGER', 'VIEWER'])
  async getCashSession(
    @CurrentTenant() tenant: { tenantId: string; storeId: string },
    @Param('sessionId') sessionId: string,
  ) {
    return await this.cashService.getCashSessionById(
      tenant.tenantId,
      tenant.storeId,
      sessionId,
    );
  }
}
