/**
 * Utilitários e Validador Centralizado de CORS
 * Utilizado de forma unificada no Express e no Socket.IO.
 */

/**
 * Sanitiza e extrai a origem válida (protocolo + hostname + porta opcional).
 * Descarta qualquer caminho, query param ou trailing slash.
 */
export function sanitizeOrigin(urlStr: string | undefined): string | null {
  if (!urlStr) return null;
  const trimmed = urlStr.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.origin;
  } catch {
    const cleaned = trimmed.replace(/\/+$/, '');
    if (/^https?:\/\/[a-zA-Z0-9\-._~%!$&'()*+,;=]+(:[0-9]+)?$/.test(cleaned)) {
      return cleaned;
    }
    return null;
  }
}

/**
 * Monta o conjunto estrito de origens autorizadas com base nas variáveis
 * de ambiente disponíveis e configuração explícita:
 * - APP_URL: URL pública da aplicação informada via variável de ambiente (se existir).
 * - ALLOWED_ORIGINS: Lista opcional (separada por vírgula) de origens adicionais.
 * Se nenhuma estiver configurada, allAllowed será vazio e em produção nenhuma origem externa é permitida.
 */
export function getResolvedAllowedOrigins(): { appOrigin: string | null; allAllowed: string[] } {
  const allowedSet = new Set<string>();

  // 1. Origens da própria aplicação na plataforma Google AI Studio
  const defaultKnownOrigins = [
    'https://sistema-gestao.ai.studio',
    'http://sistema-gestao.ai.studio'
  ];
  defaultKnownOrigins.forEach(o => allowedSet.add(o));

  // 2. Origem pública da aplicação informada pelo ambiente (APP_URL), somente se existir
  const appOrigin = process.env.APP_URL ? sanitizeOrigin(process.env.APP_URL) : null;
  if (appOrigin) {
    allowedSet.add(appOrigin);
  }

  // 3. Origens adicionais configuradas opcionalmente via ALLOWED_ORIGINS
  const rawAllowedOrigins = process.env.ALLOWED_ORIGINS || '';
  if (rawAllowedOrigins.trim()) {
    rawAllowedOrigins
      .split(',')
      .map(o => sanitizeOrigin(o))
      .filter((o): o is string => Boolean(o))
      .forEach(o => allowedSet.add(o));
  }

  return {
    appOrigin,
    allAllowed: Array.from(allowedSet)
  };
}

/**
 * Validador unificado de CORS aplicado tanto ao Express quanto ao Socket.IO.
 * - Em produção: Sem wildcards, sem run.app genérico, sem localhost. Apenas origens
 *   válidas identificadas via APP_URL (se existir) e ALLOWED_ORIGINS explicitamente listadas.
 *   Origem ausente é terminantemente rejeitada (não atua como wildcard).
 * - Em desenvolvimento/testes: Permite requisições sem origin (curl, scripts internos)
 *   e origens de desenvolvimento local (localhost, 127.0.0.1).
 */
export function validateCorsOrigin(
  origin: string | undefined,
  isProd: boolean,
  callback: (err: Error | null, allow?: boolean) => void
): void {
  const { allAllowed } = getResolvedAllowedOrigins();

  if (isProd) {
    // 1. Em produção, rejeita origem ausente (não aceita como wildcard)
    if (!origin) {
      return callback(new Error('Bloqueado por CORS: Origem ausente não permitida em produção.'));
    }

    // 2. Em produção, validação exata contra a lista de origens autorizadas
    if (allAllowed.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Bloqueado por CORS: Origem ${origin} não autorizada em produção.`));
  }

  // Ambiente de desenvolvimento e testes:
  // Permite chamadas internas sem origin (curl, scripts de teste, backend-to-backend)
  if (!origin) {
    return callback(null, true);
  }

  // Permite a própria origem da aplicação e origens explícitas
  if (allAllowed.includes(origin)) {
    return callback(null, true);
  }

  // Permite origens locais de desenvolvimento (localhost e 127.0.0.1 com qualquer porta)
  const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (isLocalOrigin) {
    return callback(null, true);
  }

  return callback(new Error(`Bloqueado por CORS: Origem ${origin} não autorizada em ambiente de desenvolvimento.`));
}
