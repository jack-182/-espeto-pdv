import crypto from 'crypto';

export class IdempotencyConflictError extends Error {
  statusCode = 409;
  constructor(message = 'Idempotency-Key já utilizada para uma requisição diferente.') {
    super(message);
    this.name = 'IdempotencyConflictError';
  }
}

/**
 * Normaliza de forma determinística e recursiva qualquer estrutura de dados
 * ordenando todas as chaves de objetos.
 */
export function canonicalizePayload(data: any): any {
  if (data === null || data === undefined) {
    return null;
  }
  if (typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(canonicalizePayload);
  }
  const keys = Object.keys(data).sort();
  const canonicalObj: Record<string, any> = {};
  for (const key of keys) {
    canonicalObj[key] = canonicalizePayload(data[key]);
  }
  return canonicalObj;
}

/**
 * Gera o fingerprint determinístico SHA-256 considerando:
 * - tenantId
 * - storeId
 * - endpoint/operação
 * - payload normalizado
 */
export function generateRequestFingerprint(params: {
  tenantId: string;
  storeId?: string;
  endpoint: string;
  payload: any;
}): string {
  const canonical = {
    tenantId: params.tenantId,
    storeId: params.storeId || '',
    endpoint: params.endpoint,
    payload: canonicalizePayload(params.payload)
  };

  const serialized = JSON.stringify(canonical);
  return crypto.createHash('sha256').update(serialized).digest('hex');
}
