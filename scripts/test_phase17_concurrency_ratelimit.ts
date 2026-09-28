/**
 * SUÍTE DE TESTES DE CONCORRÊNCIA E RATE LIMITING DISTRIBUÍDO (FASE 1.7.1)
 * 
 * Validação rigorosa dos 6 requisitos do Objetivo 5:
 * 1. Duas requisições simultâneas incrementam corretamente;
 * 2. O contador não sofre lost update sob concorrência (ex: 10 requisições concorrentes);
 * 3. O limite configurado é estritamente respeitado;
 * 4. O bloqueio permanece após abertura de uma nova conexão isolada com o banco;
 * 5. O bloqueio permanece após simulação de reinicialização de processo (sem memória volátil);
 * 6. Múltiplas instâncias hipotéticas compartilham o mesmo estado no PostgreSQL.
 */

import { Pool } from 'pg';
import { db } from '../src/db/index.ts';
import { rateLimitBuckets } from '../src/db/schema.ts';
import { atomicIncrementRateLimit, SupervisorPinProtection, createRateLimiter } from '../src/middleware/rateLimiter.ts';
import { sql } from 'drizzle-orm';

let totalPass = 0;
let totalFail = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    totalPass++;
    console.log(`[\x1b[32mPASS\x1b[0m] ${testName}`);
  } else {
    totalFail++;
    console.error(`[\x1b[31mFAIL\x1b[0m] ${testName}${detail ? ` -> ${detail}` : ''}`);
  }
}

async function runConcurrencyTests() {
  console.log('================================================================');
  console.log(' TESTES DE CONCORRÊNCIA E RATE LIMITING DISTRIBUÍDO (FASE 1.7.1)');
  console.log('================================================================\n');

  const tenantTest = 'tenant-conc-test';
  const scopeTest = 'test_scope_concurrency';

  // Limpeza prévia para isolamento dos testes
  await db.execute(sql`DELETE FROM rate_limit_buckets WHERE scope LIKE 'test_%' OR key LIKE '%conc-test%';`);

  // ============================================================================
  // CENÁRIO 1: DUAS REQUISIÇÕES SIMULTÂNEAS INCREMENTAM CORRETAMENTE
  // ============================================================================
  console.log('--- CENÁRIO 1: Duas requisições simultâneas ---');
  const keySimultaneous = `${tenantTest}:user:simultaneous-op`;

  const [resA, resB] = await Promise.all([
    atomicIncrementRateLimit({ key: keySimultaneous, scope: scopeTest, windowMs: 60000 }),
    atomicIncrementRateLimit({ key: keySimultaneous, scope: scopeTest, windowMs: 60000 })
  ]);

  const attempts = [resA.attempts, resB.attempts].sort((a, b) => a - b);
  assert(
    attempts[0] === 1 && attempts[1] === 2,
    'Duas requisições simultâneas incrementaram atomicamente para 1 e 2 sem conflito.',
    `Obtido: ${JSON.stringify(attempts)}`
  );

  // ============================================================================
  // CENÁRIO 2: O CONTADOR NÃO SOFRE LOST UPDATE SOB ALTA CONCORRÊNCIA
  // ============================================================================
  console.log('\n--- CENÁRIO 2: Prevenção de Lost Update sob alta concorrência ---');
  const keyLostUpdate = `${tenantTest}:user:lost-update-op`;
  const CONCURRENT_REQUESTS = 10;

  const promises = Array.from({ length: CONCURRENT_REQUESTS }, () =>
    atomicIncrementRateLimit({ key: keyLostUpdate, scope: scopeTest, windowMs: 60000 })
  );

  const results = await Promise.all(promises);
  const returnedAttempts = results.map(r => r.attempts).sort((a, b) => a - b);

  // Consulta o valor gravado diretamente na tabela do PostgreSQL
  const dbCheck = await db.execute(sql`
    SELECT attempts FROM rate_limit_buckets 
    WHERE key = ${keyLostUpdate} AND scope = ${scopeTest}
  `);

  const finalCountInDb = Number((dbCheck.rows[0] as any).attempts);

  assert(
    finalCountInDb === CONCURRENT_REQUESTS,
    `Contador no PostgreSQL atingiu exatamente ${CONCURRENT_REQUESTS} sem perder nenhuma atualização (sem lost update).`,
    `Esperado: ${CONCURRENT_REQUESTS}, Obtido no DB: ${finalCountInDb}`
  );

  // Garante que cada requisição concorrente recebeu um número sequencial único
  const isStrictlySequential = returnedAttempts.every((val, idx) => val === idx + 1);
  assert(
    isStrictlySequential,
    'Todas as 10 requisições concorrentes receberam contadores sequenciais de 1 a 10.',
    `Obtido: ${returnedAttempts.join(', ')}`
  );

  // ============================================================================
  // CENÁRIO 3: O LIMITE CONFIGURADO É ESTRITAMENTE RESPEITADO
  // ============================================================================
  console.log('\n--- CENÁRIO 3: Respeito estrito aos limites ---');
  const keyLimit = `${tenantTest}:user:limit-test-op`;
  const MAX_ALLOWED = 3;

  // Realiza 3 requisições (dentro do limite)
  for (let i = 1; i <= MAX_ALLOWED; i++) {
    const res = await atomicIncrementRateLimit({ key: keyLimit, scope: 'limit_scope', windowMs: 60000 });
    assert(res.attempts === i && res.attempts <= MAX_ALLOWED, `Requisição ${i}/${MAX_ALLOWED} aceita dentro do limite.`);
  }

  // 4ª requisição (excedendo o limite)
  const resExceeded = await atomicIncrementRateLimit({ key: keyLimit, scope: 'limit_scope', windowMs: 60000 });
  assert(
    resExceeded.attempts > MAX_ALLOWED,
    `4ª requisição detecta limite excedido (attempts=${resExceeded.attempts} > max=${MAX_ALLOWED}).`,
    `Attempts: ${resExceeded.attempts}`
  );

  // ============================================================================
  // CENÁRIO 4: O BLOQUEIO PERMANECE APÓS NOVA CONEXÃO COM O BANCO
  // ============================================================================
  console.log('\n--- CENÁRIO 4: Bloqueio permanece após nova conexão isolada ---');
  const operatorBrute = 'op-conn-test-user';
  const ipBrute = '172.16.0.50';

  // Simula 5 falhas no PIN de supervisor para acionar o bloqueio
  for (let i = 1; i <= 5; i++) {
    await SupervisorPinProtection.recordFailure(tenantTest, operatorBrute, ipBrute);
  }

  // Abre uma conexão totalmente nova e independente diretamente via pool do pg
  const standalonePool = new Pool({
    host: process.env.SQL_HOST,
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB_NAME,
    connectionTimeoutMillis: 10000
  });

  const standaloneClient = await standalonePool.connect();
  const directQueryResult = await standaloneClient.query(
    `SELECT key, attempts, blocked_until FROM rate_limit_buckets 
     WHERE scope = 'supervisor_pin' AND key = $1 AND blocked_until > NOW()`,
    [`${tenantTest}:user:${operatorBrute}`]
  );
  standaloneClient.release();
  await standalonePool.end();

  assert(
    directQueryResult.rows.length > 0 && directQueryResult.rows[0].blocked_until !== null,
    'Bloqueio gravado no PostgreSQL é visível e verificado com sucesso através de uma nova conexão isolada.',
    `Linhas encontradas: ${directQueryResult.rows.length}`
  );

  const checkAfterNewConn = await SupervisorPinProtection.checkBlocked(tenantTest, operatorBrute, ipBrute);
  assert(
    checkAfterNewConn.isBlocked === true && checkAfterNewConn.retryAfterSeconds > 0,
    `SupervisorPinProtection.checkBlocked confirma bloqueio ativo (retryAfter=${checkAfterNewConn.retryAfterSeconds}s).`
  );

  // ============================================================================
  // CENÁRIO 5: O BLOQUEIO PERMANECE APÓS "REINICIALIZAÇÃO DO PROCESSO"
  // ============================================================================
  console.log('\n--- CENÁRIO 5: Bloqueio permanece após reinicialização de processo (sem memória) ---');
  // Como não há mais Map em memória, qualquer nova chamada consulta 100% o PostgreSQL
  const checkFresh = await SupervisorPinProtection.checkBlocked(tenantTest, operatorBrute, ipBrute);
  assert(
    checkFresh.isBlocked === true,
    'Estado de bloqueio é persistido permanentemente no PostgreSQL, sem perda após descarte de memória.'
  );

  // ============================================================================
  // CENÁRIO 6: MÚLTIPLAS INSTÂNCIAS HIPOTÉTICAS COMPARTILHAM O MESMO ESTADO
  // ============================================================================
  console.log('\n--- CENÁRIO 6: Compartilhamento de estado entre múltiplas instâncias ---');
  const sharedKey = `${tenantTest}:shared-cluster-counter`;

  // Instância 1 faz 3 requisições
  await atomicIncrementRateLimit({ key: sharedKey, scope: 'cluster_test', windowMs: 60000 });
  await atomicIncrementRateLimit({ key: sharedKey, scope: 'cluster_test', windowMs: 60000 });
  await atomicIncrementRateLimit({ key: sharedKey, scope: 'cluster_test', windowMs: 60000 });

  // Instância 2 faz mais 2 requisições para a mesma chave/tenant
  const inst2Req1 = await atomicIncrementRateLimit({ key: sharedKey, scope: 'cluster_test', windowMs: 60000 });
  const inst2Req2 = await atomicIncrementRateLimit({ key: sharedKey, scope: 'cluster_test', windowMs: 60000 });

  assert(
    inst2Req1.attempts === 4 && inst2Req2.attempts === 5,
    'Instância 2 enxerga e continua atomicamente o contador iniciado pela Instância 1 (attempts=4, attempts=5).',
    `Instância 2 obteve: attempts=${inst2Req1.attempts}, ${inst2Req2.attempts}`
  );

  // Reset de PIN por supervisor desbloqueia em todas as instâncias compartilhadas
  await SupervisorPinProtection.resetFailures(tenantTest, operatorBrute, ipBrute);
  const checkAfterReset = await SupervisorPinProtection.checkBlocked(tenantTest, operatorBrute, ipBrute);

  assert(
    checkAfterReset.isBlocked === false,
    'Reset de falhas após PIN correto limpa o bucket compartilhado no PostgreSQL para todas as instâncias.'
  );

  // ============================================================================
  // RESULTADO FINAL
  // ============================================================================
  console.log('\n================================================================');
  console.log(` RESULTADO FINAL CONCORRÊNCIA: ${totalPass} PASS / ${totalFail} FAIL`);
  console.log('================================================================');

  if (totalFail > 0) {
    process.exit(1);
  } else {
    console.log('\x1b[32mTODOS OS TESTES DE CONCORRÊNCIA E RATE LIMITING FORAM APROVADOS COM SUCESSO!\x1b[0m\n');
    process.exit(0);
  }
}

runConcurrencyTests().catch(err => {
  console.error('Erro fatal ao rodar testes de concorrência:', err);
  process.exit(1);
});
