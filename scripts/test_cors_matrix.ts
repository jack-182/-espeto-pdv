import { validateCorsOrigin, getResolvedAllowedOrigins, sanitizeOrigin } from '../src/lib/cors.ts';

async function testCorsMatrix() {
  console.log('=== TESTE DA MATRIZ DE SEGURANÇA CORS (PDV6 / AI STUDIO) ===\n');

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  function runCheck(name: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} -> ${details || ''}`);
      failed++;
    }
  }

  // 1. Verificação de Extração e Sanitização de Origem
  runCheck('sanitizeOrigin extrai origin de https://foo.run.app/path', 
    sanitizeOrigin('https://foo.run.app/path') === 'https://foo.run.app');
  runCheck('sanitizeOrigin extrai origin com porta', 
    sanitizeOrigin('http://localhost:3000/api') === 'http://localhost:3000');
  runCheck('sanitizeOrigin rejeita string vazia', 
    sanitizeOrigin('') === null);

  const { appOrigin, allAllowed } = getResolvedAllowedOrigins();
  console.log(`\nOrigem oficial detectada (APP_URL): ${appOrigin}`);
  console.log(`Todas as origens autorizadas: ${JSON.stringify(allAllowed)}\n`);

  // Helper para chamar validateCorsOrigin com Promise
  const testCors = (origin: string | undefined, isProd: boolean): Promise<{ allowed: boolean; err?: string }> => {
    return new Promise(resolve => {
      validateCorsOrigin(origin, isProd, (err, allow) => {
        if (err) {
          resolve({ allowed: false, err: err.message });
        } else {
          resolve({ allowed: Boolean(allow) });
        }
      });
    });
  };

  // 2. Testes em Modo Produção (isProd = true)
  console.log('--- CENÁRIOS EM PRODUÇÃO (isProd = true) ---');

  // a) Rejeição de origem ausente em produção (não pode ser wildcard)
  const resNoOriginProd = await testCors(undefined, true);
  runCheck('Produção: Origem ausente é REJEITADA (sem wildcard)', !resNoOriginProd.allowed, resNoOriginProd.err);

  // b) Rejeição de wildcard '*'
  const resWildcard = await testCors('*', true);
  runCheck('Produção: Wildcard "*" é REJEITADO', !resWildcard.allowed, resWildcard.err);

  // c) Rejeição de run.app genérico
  const resGenericRunApp = await testCors('https://outra-aplicacao-qualquer.run.app', true);
  runCheck('Produção: run.app genérico não autorizado é REJEITADO', !resGenericRunApp.allowed, resGenericRunApp.err);

  // d) Rejeição de localhost e 127.0.0.1 em produção
  const resLocalhostProd = await testCors('http://localhost:3000', true);
  runCheck('Produção: localhost é REJEITADO', !resLocalhostProd.allowed, resLocalhostProd.err);

  const resIpProd = await testCors('http://127.0.0.1:3000', true);
  runCheck('Produção: 127.0.0.1 é REJEITADO', !resIpProd.allowed, resIpProd.err);

  // e) Rejeição de domínio externo arbitrário
  const resEvil = await testCors('https://atacante-malicioso.com', true);
  runCheck('Produção: Domínio externo não autorizado é REJEITADO', !resEvil.allowed, resEvil.err);

  // f) Aceitação da própria origem da aplicação (APP_URL)
  if (appOrigin) {
    const resAppOrigin = await testCors(appOrigin, true);
    runCheck(`Produção: Origem da própria aplicação (${appOrigin}) é ACEITA`, resAppOrigin.allowed, resAppOrigin.err);
  } else {
    console.log('[SKIPPED] Produção: Origem oficial não configurada no ambiente (APP_URL / ALLOWED_ORIGINS ausentes)');
    skipped++;
  }

  // 3. Testes em Modo Desenvolvimento/Testes (isProd = false)
  console.log('\n--- CENÁRIOS EM DESENVOLVIMENTO (isProd = false) ---');

  // a) Origem ausente aceita em desenvolvimento (curl, scripts, local)
  const resNoOriginDev = await testCors(undefined, false);
  runCheck('Desenvolvimento: Origem ausente é ACEITA para ferramentas locais', resNoOriginDev.allowed);

  // b) localhost e 127.0.0.1 aceitos em desenvolvimento
  const resLocalhostDev = await testCors('http://localhost:3000', false);
  runCheck('Desenvolvimento: http://localhost:3000 é ACEITO', resLocalhostDev.allowed);

  const resLocalhostViteDev = await testCors('http://localhost:5173', false);
  runCheck('Desenvolvimento: http://localhost:5173 (Vite) é ACEITO', resLocalhostViteDev.allowed);

  const resIpDev = await testCors('http://127.0.0.1:3000', false);
  runCheck('Desenvolvimento: http://127.0.0.1:3000 é ACEITO', resIpDev.allowed);

  // c) Origem externa maliciosa em desenvolvimento é rejeitada
  const resEvilDev = await testCors('https://atacante-malicioso.com', false);
  runCheck('Desenvolvimento: Domínio externo não autorizado é REJEITADO', !resEvilDev.allowed, resEvilDev.err);

  console.log(`\nTOTAL DE TESTES: ${passed + failed} | APROVADOS: ${passed} | FALHAS: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

testCorsMatrix().catch(e => {
  console.error(e);
  process.exit(1);
});
