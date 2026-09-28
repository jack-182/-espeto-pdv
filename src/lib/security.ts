import crypto from 'crypto';

/**
 * MÓDULO DE SEGURANÇA CRIPTOGRÁFICA DE ALTA RESISTÊNCIA
 * 
 * Implementação de hash de PIN utilizando scrypt (memory-hard KDF):
 * - Salt criptograficamente aleatório de 16 bytes individual por usuário
 * - 64 bytes de chave derivada
 * - Comparação em tempo constante (timingSafeEqual) para mitigar ataques de timing
 * - Proibição terminante de SHA-256 simples, MD5 ou senhas em texto puro
 */

export interface ScryptHashResult {
  salt: string;
  derivedKey: string;
  formatted: string;
}

/**
 * Gera hash scrypt com salt individual para o PIN de supervisão
 */
export function hashPinScrypt(pin: string, customSalt?: string): string {
  const salt = customSalt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(pin.trim(), salt, 64).toString('hex');
  return `scrypt:${salt}:${derivedKey}`;
}

/**
 * Valida o PIN fornecido contra o hash armazenado usando timingSafeEqual
 */
export function verifyPinScrypt(pin: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !pin) {
    return false;
  }

  // Suporte estrito a hashes scrypt: format: scrypt:<salt>:<derivedKey>
  if (storedHash.startsWith('scrypt:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 3) return false;
    const [, salt, expectedKey] = parts;
    if (!salt || !expectedKey) return false;

    try {
      const derivedKey = crypto.scryptSync(pin.trim(), salt, 64).toString('hex');
      const bufA = Buffer.from(derivedKey, 'hex');
      const bufB = Buffer.from(expectedKey, 'hex');

      if (bufA.length !== bufB.length) return false;
      return crypto.timingSafeEqual(bufA, bufB);
    } catch {
      return false;
    }
  }

  return false;
}
