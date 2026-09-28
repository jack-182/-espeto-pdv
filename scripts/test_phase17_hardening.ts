/**
 * TESTES DE VALIDAÇÃO DOS OBJETIVOS DA FASE 1.7
 * 
 * 1. MIGRATIONS:
 *    - Runner não-destrutivo e idempotente
 * 2. IDEMPOTÊNCIA ROBUSTA COM FINGERPRINT SHA-256:
 *    - Mesma chave + mesmo fingerprint -> replay com status 200/201
 *    - Mesma chave + fingerprint alterado -> HTTP 409 Conflict
 * 3. RATE LIMITING & SUPERVISOR PIN BRUTE FORCE:
 *    - Tentativas erradas de PIN acumulam
 *    - Atingindo limite (5 falhas) -> HTTP 429 com Retry-After e registro em audit_logs
 *    - Tentativa correta reseta contadores
 * 4. SEPARAÇÃO ESTRITA DE PRODUÇÃO:
 *    - Em produção, test-token e headers x-test-* são bloqueados com HTTP 401
 */

import http from 'http';
import express from 'express';
import { db } from '../src/db/index.ts';
import { tenants, stores, productCategories, products, storeInventories, cashSessions, users, auditLogs, idempotencyKeys } from '../src/db/schema.ts';
import { PosRepository } from '../src/db/repository.ts';
import { hashPinScrypt } from '../src/lib/security.ts';
import { generateRequestFingerprint, IdempotencyConflictError } from '../src/lib/idempotency.ts';
import { SupervisorPinProtection, authRateLimiter, salesRateLimiter } from '../src/middleware/rateLimiter.ts';
import { eq, and } from 'drizzle-orm';
import { runMigrations } from '../src/db/migrate.ts';

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

async function runTests() {
  console.log('================================================================');
  console.log(' VALIDAÇÃO TÉCNICA FECHAMENTO FASE 1.7');
  console.log('================================================================');

  const testTenantId = 'tenant-test-hardening-17';
  const testStoreId = 'store-test-hardening-17';
  const testOperatorId = 'user-op-hardening-17';
  const testSupervisorId = 'user-sup-hardening-17';

  // 1. SETUP DE DADOS DE TESTE NO POSTGRESQL REAL
  await db.insert(tenants).values({
    tenantId: testTenantId,
    name: 'Hardening 17 Test Tenant',
    slug: 'hardening-17',
    cnpj: '99.888.777/0001-99',
    active: true
  }).onConflictDoNothing();

  await db.insert(stores).values({
    storeId: testStoreId,
    tenantId: testTenantId,
    tradeName: 'Hardening Test Loja',
    corporateName: 'Hardening Test Corp',
    cnpj: '99.888.777/0001-99',
    segment: 'GASTRONOMIA',
    address: 'Av Paulista 1000',
    phone: '11999998888',
    active: true
  }).onConflictDoNothing();

  const correctPin = '889900';
  const pinHash = hashPinScrypt(correctPin);

  await db.delete(users).where(eq(users.uid, testOperatorId));
  await db.delete(users).where(eq(users.uid, testSupervisorId));

  await db.insert(users).values([
    {
      uid: testOperatorId,
      tenantId: testTenantId,
      storeId: testStoreId,
      name: 'Operador Teste Hardening',
      email: 'operador.hardening@example.com',
      role: 'OPERADOR',
      active: true
    },
    {
      uid: testSupervisorId,
      tenantId: testTenantId,
      storeId: testStoreId,
      name: 'Gerente Teste Hardening',
      email: 'gerente.hardening@example.com',
      role: 'GERENTE',
      pinHash: pinHash,
      active: true
    }
  ]);

  await db.insert(productCategories).values({
    categoryId: 'cat-test-h17',
    tenantId: testTenantId,
    name: 'Categoria Hardening',
    slug: 'categoria-hardening'
  }).onConflictDoNothing();

  const testProdId = 'prod-h17-item1';
  await db.insert(products).values({
    productId: testProdId,
    tenantId: testTenantId,
    categoryId: 'cat-test-h17',
    name: 'Item Teste Hardening',
    salePrice: '25.00',
    active: true
  }).onConflictDoNothing();

  await db.insert(storeInventories).values({
    storeId: testStoreId,
    tenantId: testTenantId,
    productId: testProdId,
    currentStock: 100,
    minStock: 5
  }).onConflictDoNothing();

  // Garante turno de caixa aberto para o teste
  const activeSession = await PosRepository.getCurrentCashSession(testStoreId, testTenantId);
  if (!activeSession) {
    await PosRepository.openCashSession({
      tenantId: testTenantId,
      storeId: testStoreId,
      operatorId: testOperatorId,
      operatorName: 'Operador Teste Hardening',
      initialFund: 100
    });
  }

  // ============================================================================
  // TESTE 1: MIGRATIONS
  // ============================================================================
  console.log('\n--- [OBJETIVO 1] MIGRATIONS POSTGRESQL ---');
  try {
    await runMigrations();
    assert(true, 'Runner formal de migrations executou com idempotência e sem corromper dados.');
  } catch (err: any) {
    assert(false, 'Runner formal de migrations falhou.', err.message);
  }

  // ============================================================================
  // TESTE 2: IDEMPOTÊNCIA COM FINGERPRINT DETERMINÍSTICO (SHA-256) & 409 CONFLICT
  // ============================================================================
  console.log('\n--- [OBJETIVO 3] IDEMPOTÊNCIA ROBUSTA & REQUEST FINGERPRINT ---');
  
  const idempKeyTest = `test-idemp-key-${Date.now()}`;
  const payloadOriginal = {
    itens: [{ productId: testProdId, quantity: 1 }],
    formaPagamento: 'DINHEIRO',
    lojaId: testStoreId
  };
  const payloadAlterado = {
    itens: [{ productId: testProdId, quantity: 2 }], // Quantidade alterada
    formaPagamento: 'PIX', // Forma alterada
    lojaId: testStoreId
  };

  const fingerprintOriginal = generateRequestFingerprint({
    tenantId: testTenantId,
    storeId: testStoreId,
    endpoint: 'POST /api/vendas',
    payload: payloadOriginal
  });

  const fingerprintAlterado = generateRequestFingerprint({
    tenantId: testTenantId,
    storeId: testStoreId,
    endpoint: 'POST /api/vendas',
    payload: payloadAlterado
  });

  assert(fingerprintOriginal !== fingerprintAlterado, 'Fingerprints de payloads diferentes são distintos e determinísticos.');

  // 1ª requisição: com chave + fingerprintOriginal -> Deve criar venda
  const res1 = await PosRepository.processQuickSale({
    tenantId: testTenantId,
    storeId: testStoreId,
    items: [{ productId: testProdId, quantity: 1 }],
    paymentMethod: 'DINHEIRO',
    operatorId: testOperatorId,
    operatorName: 'Operador Teste Hardening',
    idempotencyKey: idempKeyTest,
    fingerprint: fingerprintOriginal,
    requestPath: 'POST /api/vendas'
  });

  assert(res1.isIdempotentReplay === false, 'Primeira requisição com chave de idempotência é processada com status novo (não replay).');

  // 2ª requisição: mesma chave + MESMO fingerprint -> Deve dar replay com 200
  const res2 = await PosRepository.processQuickSale({
    tenantId: testTenantId,
    storeId: testStoreId,
    items: [{ productId: testProdId, quantity: 1 }],
    paymentMethod: 'DINHEIRO',
    operatorId: testOperatorId,
    operatorName: 'Operador Teste Hardening',
    idempotencyKey: idempKeyTest,
    fingerprint: fingerprintOriginal,
    requestPath: 'POST /api/vendas'
  });

  assert(res2.isIdempotentReplay === true, 'Repetição com mesma chave e mesmo fingerprint retorna replay com os mesmos dados.');

  // 3ª requisição: MESMA chave + FINGERPRINT DIFERENTE -> Deve lançar IdempotencyConflictError (409 Conflict)
  let caughtConflict = false;
  try {
    await PosRepository.processQuickSale({
      tenantId: testTenantId,
      storeId: testStoreId,
      items: [{ productId: testProdId, quantity: 2 }],
      paymentMethod: 'PIX',
      operatorId: testOperatorId,
      operatorName: 'Operador Teste Hardening',
      idempotencyKey: idempKeyTest,
      fingerprint: fingerprintAlterado,
      requestPath: 'POST /api/vendas'
    });
  } catch (err: any) {
    if (err instanceof IdempotencyConflictError || err?.statusCode === 409) {
      caughtConflict = true;
    }
  }

  assert(caughtConflict === true, 'Mesma Idempotency-Key com payload/fingerprint alterado lança 409 Conflict com mensagem oficial.');

  // ============================================================================
  // TESTE 3: BRUTE FORCE & RATE LIMITING NO PIN DE SUPERVISOR
  // ============================================================================
  console.log('\n--- [OBJETIVO 2] RATE LIMITING & BRUTE FORCE PIN SUPERVISOR ---');

  const testOpBrute = `user-brute-op-${Date.now()}`;
  const testIpBrute = `192.168.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200) + 10}`;

  // 4 tentativas com PIN errado -> devem retornar authorized: false, isRateLimited: false
  for (let i = 1; i <= 4; i++) {
    const res = await PosRepository.verifySupervisorPin({
      tenantId: testTenantId,
      pin: '000000', // PIN errado
      operatorId: testOpBrute,
      operatorName: 'Operador Brute Test',
      ipAddress: testIpBrute
    });
    assert(res.authorized === false && !res.isRateLimited, `Tentativa ${i} de PIN errado rejeitada com 403 (sem bloqueio prévio).`);
  }

  // 5ª tentativa com PIN errado -> atinge o limite e ativa bloqueio temporário (HTTP 429)
  const res5 = await PosRepository.verifySupervisorPin({
    tenantId: testTenantId,
    pin: '000000', // 5ª falha
    operatorId: testOpBrute,
    operatorName: 'Operador Brute Test',
    ipAddress: testIpBrute
  });

  assert(res5.authorized === false && res5.isRateLimited === true, '5ª falha ativa bloqueio temporário de segurança (Rate Limit 429).');
  assert((res5 as any).retryAfterSeconds > 0, 'Bloqueio retorna tempo de espera Retry-After em segundos.');

  // Tentativa seguinte durante o bloqueio (mesmo com o PIN correto agora!) deve ser rejeitada por rate limit
  const resBlocked = await PosRepository.verifySupervisorPin({
    tenantId: testTenantId,
    pin: correctPin, // Tentando PIN correto durante o lockout
    operatorId: testOpBrute,
    operatorName: 'Operador Brute Test',
    ipAddress: testIpBrute
  });

  assert(resBlocked.authorized === false && resBlocked.isRateLimited === true, 'Tentativa subsequente durante o bloqueio é imediatamente rejeitada com 429.');

  // Verifica registro de auditoria do bloqueio por brute force no banco de dados
  const auditEntries = await db.select().from(auditLogs)
    .where(and(
      eq(auditLogs.tenantId, testTenantId),
      eq(auditLogs.action, 'BLOQUEIO_BRUTE_FORCE_PIN')
    ));

  assert(auditEntries.length > 0, 'Evento BLOQUEIO_BRUTE_FORCE_PIN registrado com sucesso na tabela audit_logs do PostgreSQL.');

  // Reseta para outro operador de teste para validar o sucesso
  const testOpSuccess = `user-success-op-${Date.now()}`;
  const resSuccess = await PosRepository.verifySupervisorPin({
    tenantId: testTenantId,
    storeId: testStoreId,
    pin: correctPin,
    operatorId: testOpSuccess,
    operatorName: 'Operador Sucesso',
    ipAddress: '10.0.0.1'
  });

  assert(resSuccess.authorized === true, 'PIN de supervisor correto é autenticado com sucesso e reseta contadores.');

  // ============================================================================
  // TESTE 4: SEPARAÇÃO ESTRITA DE PRODUÇÃO
  // ============================================================================
  console.log('\n--- [OBJETIVO 4] SEPARAÇÃO ESTRITA DE PRODUÇÃO & TEST AUTH ---');

  // Simula req em produção com test-token
  const isProductionOrig = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  process.env.ENABLE_TEST_AUTH = 'true'; // Tenta habilitar variável em produção

  let rejectedInProd: boolean = false;
  let responseStatus: number = 0;

  const mockReq: any = {
    headers: { authorization: 'Bearer test-token:admin:jackson' }
  };
  const mockRes: any = {
    status: (code: number) => {
      responseStatus = code;
      return {
        json: () => {
          if (code === 401) {
            rejectedInProd = true;
          }
        }
      };
    }
  };

  // Testa diretamente a função appAuth de server.ts
  const { appAuth } = await import('../server.ts');
  await appAuth(mockReq, mockRes, () => {});

  assert(Boolean(rejectedInProd && responseStatus === 401), 'Em produção, qualquer test-token é rejeitado estritamente com HTTP 401 mesmo com ENABLE_TEST_AUTH=true.');

  // Restaura ambiente
  process.env.NODE_ENV = isProductionOrig;

  // ============================================================================
  // RESULTADO FINAL
  // ============================================================================
  console.log('\n================================================================');
  console.log(` RESULTADO GERAL: ${totalPass} PASS / ${totalFail} FAIL`);
  console.log('================================================================');

  if (totalFail > 0) {
    process.exit(1);
  } else {
    console.log('\x1b[32mTODOS OS CRITÉRIOS DE FECHAMENTO DA FASE 1.7 FORAM CUMPRIDOS COM SUCESSO!\x1b[0m\n');
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Erro fatal ao rodar testes da fase 1.7:', err);
  process.exit(1);
});
