import { Request } from 'express';

/**
 * Extrair IP real do cliente
 */
export function getClientIp(request: Request): string {
  const xForwardedFor = request.headers['x-forwarded-for'];

  if (typeof xForwardedFor === 'string') {
    return xForwardedFor.split(',')[0].trim();
  }

  if (Array.isArray(xForwardedFor)) {
    return xForwardedFor[0];
  }

  return request.socket.remoteAddress || 'unknown';
}

/**
 * Validar se string é UUID válido
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Sanitizar valores para log (remover dados sensíveis)
 */
export function sanitizeForLog(obj: any): any {
  if (!obj) return obj;

  const sensitiveFields = ['password', 'token', 'creditCard', 'cvv', 'pinHash'];
  const sanitized = { ...obj };

  sensitiveFields.forEach((field) => {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}
