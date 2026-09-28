import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';

/**
 * Guard que valida e injeta contexto de tenant
 * TODO: Validar contra Firebase Auth que usuário tem acesso ao tenant
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // Extrair tenant context do header ou do corpo da requisição
    const tenantId = request.headers['x-tenant-id'] || request.body?.tenantId;
    const storeId = request.headers['x-store-id'] || request.body?.storeId;

    if (!tenantId) {
      throw new ForbiddenException('Tenant ID obrigatório (header: X-Tenant-Id)');
    }

    // Injetar tenant context na request
    (request as any).tenant = {
      tenantId,
      storeId: storeId || null,
    };

    return true;
  }
}
