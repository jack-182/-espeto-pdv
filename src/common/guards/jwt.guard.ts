import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import * as admin from 'firebase-admin';

/**
 * Guard que valida JWT token do Firebase
 */
@Injectable()
export class JwtGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Token JWT não fornecido');
    }

    try {
      // Validar token Firebase
      const decodedToken = await admin.auth().verifyIdToken(token);

      // Injetar dados do usuário na request
      (request as any).user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || 'Unknown',
      };

      return true;
    } catch (error) {
      throw new UnauthorizedException(`Token inválido: ${error.message}`);
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;

    if (!authHeader) return undefined;

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
