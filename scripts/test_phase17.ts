/**
 * SUÍTE DE TESTES OBRIGATÓRIA DA FASE 1.7
 * Validação rigorosa de:
 * 1. test-token em produção (rejeição nativa do Firebase Admin)
 * 2. ENABLE_TEST_AUTH=true em produção
 * 3. seedTestFixtures nunca executado em produção
 * 4. Idempotência Concorrente (Promise.all com 5 requisições simultâneas)
 * 5. Estoque Concorrente (Estoque = 1, 2 vendas simultâneas via Promise.allSettled)
 * 6. Idempotência entre Tenants (Cross-tenant idempotency: mesma chave em tenants distintos)
 * 7. CORS Origem Oficial (APP_URL / ALLOWED_ORIGINS ou SKIPPED se não configurado)
 * 8. CORS Vetores Não Autorizados (origem ausente, *, run.app genérico, localhost, 127.0.0.1, atacante externo)
 * 9. Socket test-token rejeitado pelo Firebase Admin
 * 10. Socket Firebase token inválido/ausente rejeitado
 * 11. Headers forjados com autenticação válida (x-tenant-id ignorado)
 * 12. Isolamento estrito entre tenants
 * 13. Teste de Integração Firebase Real (SKIPPED se não houver credenciais reais)
 */

import { io } from 'socket.io-client';
import express from 'express';
import http from 'http';
import { db } from '../src/db/index.ts';
import { 
  tenants, 
  stores, 
  productCategories, 
  products, 
  storeInventories, 
  orders, 
  idempotencyKeys, 
  users 
} from '../src/db/schema.ts';
import { PosRepository } from '../src/db/repository.ts';
import { seedDatabase } from '../src/db/seed.ts';
import { validateCorsOrigin, getResolvedAllowedOrigins } from '../src/lib/cors.ts';
import { requireAuth } from '../src/middleware/auth.ts';
import { handleTestAuth } from '../src/tests/fixtures/testAuth.ts';
import { validateBody, vendaSchema } from '../src/middleware/validation.ts';
import { adminAuth } from '../src/lib/firebase-admin.ts';
import { eq, and } from 'drizzle-orm';

interface TestRecord {
  id: number;
  categoria: string;
  descricao: string;
  esperado: string;
  obtido: string;
  status: 'PASS' | 'FAIL' | 'SKIPPED';
  detalhes?: string;
}

const testResults: TestRecord[] = [];

function record(
  id: number,
  categoria: string,
  descricao: string,
  status: 'PASS' | 'FAIL' | 'SKIPPED',
  esperado: string,
  obtido: string,
  detalhes?: string
) {
  testResults.push({ id, categoria, descricao, status, esperado, obtido, detalhes });
  let statusStr = '';
  if (status === 'PASS') {
    statusStr = '[\x1b[32mPASS\x1b[0m]   ';
  } else if (status === 'FAIL') {
    statusStr = '[\x1b[31mFAIL\x1b[0m]   ';
  } else {
    statusStr = '[\x1b[33mSKIPPED\x1b[0m]';
  }

  console.log(`${statusStr} #${id.toString().padStart(2, '0')} [${categoria}]: ${descricao}`);
  if (status === 'FAIL') {
    console.log(`         Esperado: ${esperado}`);
    console.log(`         Obtido:   ${obtido}`);
    if (detalhes) console.log(`         Detalhes: ${detalhes}`);
  } else if (status === 'SKIPPED') {
    console.log(`         Motivo:   ${obtido}`);
  }
}

async function prepareFixtures() {
  // Tenant A e Tenant B
  await db.insert(tenants).values([
    {
      tenantId: 'tenant-phase17-a',
      name: 'Tenant 17 A Corp',
      slug: 'tenant-17-a',
      cnpj: '11.111.111/0001-11',
      active: true
    },
    {
      tenantId: 'tenant-phase17-b',
      name: 'Tenant 17 B Corp',
      slug: 'tenant-17-b',
      cnpj: '22.222.222/0001-22',
      active: true
    }
  ]).onConflictDoNothing();

  // Stores
  await db.insert(stores).values([
    {
      storeId: 'store-17-a',
      tenantId: 'tenant-phase17-a',
      tradeName: 'Loja 17 A',
      corporateName: 'Loja 17 A SA',
      cnpj: '11.111.111/0001-11',
      segment: 'SUPERMERCADO',
      address: 'Rua A, 10',
      phone: '(11) 98888-1111',
      active: true
    },
    {
      storeId: 'store-17-b',
      tenantId: 'tenant-phase17-b',
      tradeName: 'Loja 17 B',
      corporateName: 'Loja 17 B SA',
      cnpj: '22.222.222/0001-22',
      segment: 'CONVENIENCIA',
      address: 'Rua B, 20',
      phone: '(11) 98888-2222',
      active: true
    }
  ]).onConflictDoNothing();

  // Categorias
  await db.insert(productCategories).values([
    {
      categoryId: 'cat-17-a',
      tenantId: 'tenant-phase17-a',
      name: 'Bebidas A',
      slug: 'bebidas-a'
    },
    {
      categoryId: 'cat-17-b',
      tenantId: 'tenant-phase17-b',
      name: 'Bebidas B',
      slug: 'bebidas-b'
    }
  ]).onConflictDoNothing();

  // Produtos
  await db.insert(products).values([
    {
      productId: 'prod-17-idemp-a',
      tenantId: 'tenant-phase17-a',
      categoryId: 'cat-17-a',
      name: 'Refrigerante Cola A 350ml',
      salePrice: '5.00',
      costPrice: '2.50',
      unit: 'UN',
      barcode: '789170000001',
      active: true
    },
    {
      productId: 'prod-17-idemp-b',
      tenantId: 'tenant-phase17-b',
      categoryId: 'cat-17-b',
      name: 'Refrigerante Cola B 350ml',
      salePrice: '6.00',
      costPrice: '3.00',
      unit: 'UN',
      barcode: '789170000002',
      active: true
    },
    {
      productId: 'prod-17-stock-race',
      tenantId: 'tenant-phase17-a',
      categoryId: 'cat-17-a',
      name: 'Item Limitado de Alta Concorrência',
      salePrice: '10.00',
      costPrice: '5.00',
      unit: 'UN',
      barcode: '789170000003',
      active: true
    }
  ]).onConflictDoNothing();

  // Inventário inicial limpo
  await db.delete(storeInventories).where(eq(storeInventories.storeId, 'store-17-a'));
  await db.delete(storeInventories).where(eq(storeInventories.storeId, 'store-17-b'));

  await db.insert(storeInventories).values([
    {
      storeId: 'store-17-a',
      productId: 'prod-17-idemp-a',
      tenantId: 'tenant-phase17-a',
      currentStock: 100,
      minStock: 5,
      maxStock: 500
    },
    {
      storeId: 'store-17-b',
      productId: 'prod-17-idemp-b',
      tenantId: 'tenant-phase17-b',
      currentStock: 100,
      minStock: 5,
      maxStock: 500
    },
    {
      storeId: 'store-17-a',
      productId: 'prod-17-stock-race',
      tenantId: 'tenant-phase17-a',
      currentStock: 1, // Exatamente 1 unidade para concorrência real
      minStock: 0,
      maxStock: 10
    }
  ]);

  // Limpa chaves de idempotência de testes anteriores
  await db.delete(idempotencyKeys).where(eq(idempotencyKeys.tenantId, 'tenant-phase17-a'));
  await db.delete(idempotencyKeys).where(eq(idempotencyKeys.tenantId, 'tenant-phase17-b'));

  // Usuário legítimo para testes de autorização e headers forjados
  await db.insert(users).values([
    {
      uid: 'user-17-a',
      tenantId: 'tenant-phase17-a',
      storeId: 'store-17-a',
      name: 'Operador Legítimo Tenant A',
      email: 'operador.17a@exemplo.com',
      role: 'OPERADOR',
      active: true
    }
  ]).onConflictDoNothing();
}

async function runAllTests() {
  console.log('\n================================================================');
  console.log('   SUÍTE DE TESTES RIGOROSOS DE SEGURANÇA E CONCORRÊNCIA (FASE 1.7)');
  console.log('================================================================\n');

  await prepareFixtures();

  // ===========================================================================
  // 1. TEST-TOKEN EM PRODUÇÃO (REJEIÇÃO PELO FIREBASE ADMIN)
  // ===========================================================================
  {
    let statusCode: number | null = null;
    let responseBody: any = null;

    const mockReq: any = {
      headers: { authorization: 'Bearer test-token:admin' }
    };
    const mockRes: any = {
      status(code: number) {
        statusCode = code;
        return {
          json(data: any) {
            responseBody = data;
          }
        };
      }
    };

    await requireAuth(mockReq, mockRes, () => {});

    const passou = statusCode === 401 && responseBody?.sucesso === false;
    record(
      1,
      'test-token auth',
      'Bearer test-token é rejeitado pelo Firebase Admin verifyIdToken como inválido (HTTP 401)',
      passou ? 'PASS' : 'FAIL',
      'HTTP 401 com sucesso: false',
      `HTTP ${statusCode} com ${JSON.stringify(responseBody)}`
    );
  }

  // ===========================================================================
  // 2. ENABLE_TEST_AUTH=true EM PRODUÇÃO
  // ===========================================================================
  {
    const savedTestAuth = process.env.ENABLE_TEST_AUTH;
    const savedNodeEnv = process.env.NODE_ENV;
    process.env.ENABLE_TEST_AUTH = 'true';
    process.env.NODE_ENV = 'production';

    let statusCode: number | null = null;
    let responseBody: any = null;

    const mockReq: any = {
      headers: { authorization: 'Bearer test-token:operador' }
    };
    const mockRes: any = {
      status(code: number) {
        statusCode = code;
        return {
          json(data: any) {
            responseBody = data;
          }
        };
      }
    };
    await requireAuth(mockReq, mockRes, () => {});

    // Restaura env
    process.env.ENABLE_TEST_AUTH = savedTestAuth;
    process.env.NODE_ENV = savedNodeEnv;

    const passou = statusCode === 401;
    record(
      2,
      'ENABLE_TEST_AUTH prod',
      'ENABLE_TEST_AUTH=true em produção NUNCA autoriza test-token (HTTP 401)',
      passou ? 'PASS' : 'FAIL',
      'HTTP 401',
      `HTTP ${statusCode}`
    );
  }

  // ===========================================================================
  // 3. SEED TEST FIXTURES NUNCA EXECUTADO EM PRODUÇÃO
  // ===========================================================================
  {
    const savedTestAuth = process.env.ENABLE_TEST_AUTH;
    const savedNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_TEST_AUTH = 'true';

    // Remove fixture demo exclusiva se existir
    await db.delete(users).where(eq(users.uid, 'user-prod-fixture-guard-test'));

    // Executa seedDatabase em modo production simulado
    await seedDatabase();

    const checkUser = await db.select().from(users).where(eq(users.uid, 'user-test-fixture-exclusive'));
    
    // Restaura env
    process.env.ENABLE_TEST_AUTH = savedTestAuth;
    process.env.NODE_ENV = savedNodeEnv;

    const passou = checkUser.length === 0;
    record(
      3,
      'seed production',
      'seedTestFixtures() NUNCA executa quando NODE_ENV=production (mesmo com ENABLE_TEST_AUTH=true)',
      passou ? 'PASS' : 'FAIL',
      'Fixtures de teste ausentes no banco de produção',
      passou ? 'Fixtures bloqueadas com sucesso' : 'Fixtures foram inseridas indevidamente'
    );
  }

  // ===========================================================================
  // 4. IDEMPOTÊNCIA CONCORRENTE (PROMISE.ALL COM 5 REQUISIÇÕES SIMULTÂNEAS)
  // ===========================================================================
  {
    const sharedKey = `idemp-race-${Date.now()}`;
    const initialInv = await db.select().from(storeInventories).where(
      and(
        eq(storeInventories.storeId, 'store-17-a'),
        eq(storeInventories.productId, 'prod-17-idemp-a')
      )
    );
    const initialStock = initialInv[0].currentStock;

    // Executa 5 chamadas simultâneas via Promise.all (concorrência real)
    const promises = Array.from({ length: 5 }).map(() => 
      PosRepository.processQuickSale({
        tenantId: 'tenant-phase17-a',
        storeId: 'store-17-a',
        items: [{ productId: 'prod-17-idemp-a', quantity: 2 }],
        paymentMethod: 'PIX',
        operatorId: 'user-17-a',
        operatorName: 'Operador Tenant A',
        idempotencyKey: sharedKey
      })
    );

    const responses = await Promise.all(promises);

    const originalSales = responses.filter(r => !r.isIdempotentReplay);
    const replaySales = responses.filter(r => r.isIdempotentReplay);

    const finalInv = await db.select().from(storeInventories).where(
      and(
        eq(storeInventories.storeId, 'store-17-a'),
        eq(storeInventories.productId, 'prod-17-idemp-a')
      )
    );
    const finalStock = finalInv[0].currentStock;
    const stockDeduction = initialStock - finalStock;

    const firstOrderId = (responses[0].data as any).order?.orderId;
    const allSameOrder = responses.every(r => (r.data as any).order?.orderId === firstOrderId);

    const countOrdersInDb = await db.select().from(orders).where(
      and(
        eq(orders.tenantId, 'tenant-phase17-a'),
        eq(orders.orderId, firstOrderId)
      )
    );

    const passou = 
      originalSales.length === 1 &&
      replaySales.length === 4 &&
      stockDeduction === 2 &&
      allSameOrder &&
      countOrdersInDb.length === 1;

    record(
      4,
      'idempotência concorrente',
      '5 requisições concorrentes com mesma chave resultam em exatamente 1 venda, 1 baixa de estoque e 4 replays',
      passou ? 'PASS' : 'FAIL',
      '1 venda nova, 4 replays, baixa de estoque = 2',
      `${originalSales.length} novas, ${replaySales.length} replays, baixa = ${stockDeduction}`
    );
  }

  // ===========================================================================
  // 5. ESTOQUE CONCORRENTE (ESTOQUE = 1, 2 VENDAS SIMULTÂNEAS)
  // ===========================================================================
  {
    await db.update(storeInventories)
      .set({ currentStock: 1 })
      .where(and(
        eq(storeInventories.storeId, 'store-17-a'),
        eq(storeInventories.productId, 'prod-17-stock-race')
      ));

    // Duas vendas simultâneas competindo pela ÚLTIMA unidade via Promise.allSettled
    const results = await Promise.allSettled([
      PosRepository.processQuickSale({
        tenantId: 'tenant-phase17-a',
        storeId: 'store-17-a',
        items: [{ productId: 'prod-17-stock-race', quantity: 1 }],
        paymentMethod: 'DINHEIRO',
        operatorId: 'user-17-a',
        operatorName: 'Operador Concorrente 1',
        idempotencyKey: `stock-race-1-${Date.now()}`
      }),
      PosRepository.processQuickSale({
        tenantId: 'tenant-phase17-a',
        storeId: 'store-17-a',
        items: [{ productId: 'prod-17-stock-race', quantity: 1 }],
        paymentMethod: 'CARTAO_DEBITO',
        operatorId: 'user-17-a',
        operatorName: 'Operador Concorrente 2',
        idempotencyKey: `stock-race-2-${Date.now()}`
      })
    ]);

    const approved = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    let rejectionReason = '';
    if (rejected.length > 0) {
      rejectionReason = (rejected[0] as PromiseRejectedResult).reason?.message || '';
    }

    const checkStock = await db.select().from(storeInventories).where(and(
      eq(storeInventories.storeId, 'store-17-a'),
      eq(storeInventories.productId, 'prod-17-stock-race')
    ));
    const finalStock = checkStock[0].currentStock;

    const passou = 
      approved.length === 1 &&
      rejected.length === 1 &&
      finalStock === 0 &&
      rejectionReason.includes('Estoque insuficiente');

    record(
      5,
      'estoque concorrente',
      'Estoque = 1 com 2 vendas simultâneas: 1 aprovada, 1 rejeitada com "Estoque insuficiente", estoque final = 0',
      passou ? 'PASS' : 'FAIL',
      '1 aprovada, 1 rejeitada, estoque final = 0',
      `${approved.length} aprovadas, ${rejected.length} rejeitadas, estoque final = ${finalStock}, motivo: ${rejectionReason}`
    );
  }

  // ===========================================================================
  // 6. IDEMPOTÊNCIA ENTRE TENANTS (CROSS-TENANT IDEMPOTENCY)
  // ===========================================================================
  {
    const crossTenantKey = `cross-tenant-shared-key-${Date.now()}`;

    // Tenant A usa a chave
    const saleTenantA = await PosRepository.processQuickSale({
      tenantId: 'tenant-phase17-a',
      storeId: 'store-17-a',
      items: [{ productId: 'prod-17-idemp-a', quantity: 1 }],
      paymentMethod: 'PIX',
      operatorId: 'user-17-a',
      operatorName: 'Operador Tenant A',
      idempotencyKey: crossTenantKey
    });

    // Tenant B usa EXATAMENTE A MESMA CHAVE
    const saleTenantB = await PosRepository.processQuickSale({
      tenantId: 'tenant-phase17-b',
      storeId: 'store-17-b',
      items: [{ productId: 'prod-17-idemp-b', quantity: 1 }],
      paymentMethod: 'PIX',
      operatorId: 'user-17-b',
      operatorName: 'Operador Tenant B',
      idempotencyKey: crossTenantKey
    });

    const bothApprovedAsNew = !saleTenantA.isIdempotentReplay && !saleTenantB.isIdempotentReplay;

    // Tenant A executa replay da chave
    const replayTenantA = await PosRepository.processQuickSale({
      tenantId: 'tenant-phase17-a',
      storeId: 'store-17-a',
      items: [{ productId: 'prod-17-idemp-a', quantity: 1 }],
      paymentMethod: 'PIX',
      operatorId: 'user-17-a',
      operatorName: 'Operador Tenant A',
      idempotencyKey: crossTenantKey
    });

    const replayIsCorrectTenant = 
      replayTenantA.isIdempotentReplay &&
      (replayTenantA.data as any).order?.tenantId === 'tenant-phase17-a' &&
      (replayTenantA.data as any).order?.orderId === (saleTenantA.data as any).order?.orderId;

    const dbKeys = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, crossTenantKey));

    const passou = bothApprovedAsNew && replayIsCorrectTenant && dbKeys.length === 2;

    record(
      6,
      'cross-tenant idempotency',
      'Mesma chave de idempotência é aceita em tenants distintos sem conflito no banco ou vazamento de dados',
      passou ? 'PASS' : 'FAIL',
      '2 registros independentes no banco com tenants distintos, replays isolados',
      `Registros no banco: ${dbKeys.length}, TenantA replay correto: ${replayIsCorrectTenant}`
    );
  }

  // ===========================================================================
  // 7. CORS ORIGEM OFICIAL (APP_URL / ALLOWED_ORIGINS)
  // ===========================================================================
  {
    const { appOrigin, allAllowed } = getResolvedAllowedOrigins();

    if (allAllowed.length === 0) {
      // Se nenhuma origem estiver configurada em APP_URL ou ALLOWED_ORIGINS:
      // O teste de origem oficial deve ser marcado como SKIPPED (sem inventar origens)
      record(
        7,
        'CORS oficial',
        'CORS autoriza estritamente origens oficiais configuradas em APP_URL ou ALLOWED_ORIGINS',
        'SKIPPED',
        'Origem configurada em APP_URL ou ALLOWED_ORIGINS',
        'Nenhuma origem configurada no ambiente (APP_URL / ALLOWED_ORIGINS não definidas)'
      );
    } else {
      let allAllowedPass = true;
      for (const origin of allAllowed) {
        validateCorsOrigin(origin, true, (err, allow) => {
          if (err || !allow) allAllowedPass = false;
        });
      }
      record(
        7,
        'CORS oficial',
        'CORS autoriza estritamente origens oficiais configuradas em APP_URL ou ALLOWED_ORIGINS',
        allAllowedPass ? 'PASS' : 'FAIL',
        `Todas as origens configuradas autorizadas (${allAllowed.join(', ')})`,
        allAllowedPass ? 'Autorizadas com sucesso' : 'Falha na autorização'
      );
    }
  }

  // ===========================================================================
  // 8. CORS VETORES NÃO AUTORIZADOS
  // ===========================================================================
  {
    let blockedMissingOrigin = false;
    let blockedWildcard = false;
    let blockedGenericRunApp = false;
    let blockedLocalhostInProd = false;
    let blocked127InProd = false;
    let blockedMalicious = false;

    // 1. Origem ausente em produção (deve rejeitar, nunca atuar como wildcard)
    validateCorsOrigin(undefined, true, (err) => {
      if (err) blockedMissingOrigin = true;
    });

    // 2. Wildcard *
    validateCorsOrigin('*', true, (err) => {
      if (err) blockedWildcard = true;
    });

    // 3. run.app genérico diferente da aplicação
    validateCorsOrigin('https://outro-servico-arbitrario.run.app', true, (err) => {
      if (err) blockedGenericRunApp = true;
    });

    // 4. Localhost em produção
    validateCorsOrigin('http://localhost:3000', true, (err) => {
      if (err) blockedLocalhostInProd = true;
    });

    // 5. 127.0.0.1 em produção
    validateCorsOrigin('http://127.0.0.1:3000', true, (err) => {
      if (err) blocked127InProd = true;
    });

    // 6. Domínio malicioso arbitrário
    validateCorsOrigin('https://hacker-phishing.com', true, (err) => {
      if (err) blockedMalicious = true;
    });

    const passou = 
      blockedMissingOrigin &&
      blockedWildcard &&
      blockedGenericRunApp &&
      blockedLocalhostInProd &&
      blocked127InProd &&
      blockedMalicious;

    record(
      8,
      'CORS bloqueios',
      'CORS rejeita com erro em produção: origem ausente, *, run.app arbitrário, localhost, 127.0.0.1 e atacante externo',
      passou ? 'PASS' : 'FAIL',
      'Todos os 6 vetores de bypass bloqueados com erro em produção',
      `Ausente: ${blockedMissingOrigin}, *: ${blockedWildcard}, RunApp: ${blockedGenericRunApp}, Localhost: ${blockedLocalhostInProd}, 127: ${blocked127InProd}, Malicioso: ${blockedMalicious}`
    );
  }

  // ===========================================================================
  // 9. SOCKET TEST-TOKEN REJEITADO
  // ===========================================================================
  {
    let socketError: string | null = null;
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = io('http://127.0.0.1:3000', {
          auth: { token: 'test-token:admin' },
          reconnection: false,
          timeout: 2000
        });

        socket.on('connect_error', (err) => {
          socketError = err.message;
          socket.close();
          resolve();
        });

        socket.on('connect', () => {
          socket.close();
          reject(new Error('Conectou indevidamente com test-token!'));
        });

        setTimeout(() => {
          socket.close();
          resolve();
        }, 2500);
      });
    } catch (e: any) {
      socketError = e.message;
    }

    // O erro deve ser a rejeição natural do Firebase Admin ('Token inválido ou expirado')
    const passou = socketError?.includes('Token inválido ou expirado') || false;
    record(
      9,
      'test-token Socket',
      'Socket.IO rejeita conexões com test-token via falha natural de validação do Firebase Admin (Token inválido ou expirado)',
      passou ? 'PASS' : 'FAIL',
      'Authentication error: Token inválido ou expirado.',
      socketError || 'Sem erro detectado'
    );
  }

  // ===========================================================================
  // 10. SOCKET FIREBASE TOKEN (INVÁLIDO / AUSENTE)
  // ===========================================================================
  {
    let missingTokenError: string | null = null;
    let invalidTokenError: string | null = null;

    // 10.1 Token ausente
    await new Promise<void>((resolve) => {
      const socket = io('http://127.0.0.1:3000', {
        auth: {},
        reconnection: false,
        timeout: 2000
      });
      socket.on('connect_error', (err) => {
        missingTokenError = err.message;
        socket.close();
        resolve();
      });
      setTimeout(() => { socket.close(); resolve(); }, 2000);
    });

    // 10.2 Token com assinatura forjada
    await new Promise<void>((resolve) => {
      const socket = io('http://127.0.0.1:3000', {
        auth: { token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature' },
        reconnection: false,
        timeout: 2000
      });
      socket.on('connect_error', (err) => {
        invalidTokenError = err.message;
        socket.close();
        resolve();
      });
      setTimeout(() => { socket.close(); resolve(); }, 2000);
    });

    const passou = 
      (missingTokenError?.includes('Token de autenticação ausente') || false) &&
      (invalidTokenError?.includes('Token inválido ou expirado') || false);

    record(
      10,
      'Socket Firebase token',
      'Socket.IO rejeita tokens ausentes e tokens inválidos/forjados com erro de autenticação',
      passou ? 'PASS' : 'FAIL',
      'Erros de autenticação retornados para token ausente e inválido',
      `Ausente: "${missingTokenError}", Inválido: "${invalidTokenError}"`
    );
  }

  // ===========================================================================
  // 11. HEADERS FORJADOS + AUTENTICAÇÃO VÁLIDA (CAMADA HTTP REAL)
  // ===========================================================================
  {
    const testApp = express();
    testApp.use(express.json());

    const hasLiveToken = Boolean(process.env.FIREBASE_TEST_ID_TOKEN);
    let validAuthHeader = '';

    if (hasLiveToken) {
      validAuthHeader = `Bearer ${process.env.FIREBASE_TEST_ID_TOKEN}`;
      testApp.use(requireAuth);
    } else {
      process.env.ENABLE_TEST_AUTH = 'true';
      validAuthHeader = 'Bearer test-token:operador:user-17-a';
      testApp.use(handleTestAuth);
    }

    testApp.get('/api/v1/auth/me', (req: any, res: any) => {
      res.json({
        sucesso: true,
        user: req.user
      });
    });

    testApp.post('/api/vendas', validateBody(vendaSchema), async (req: any, res: any) => {
      const { lojaId, formaPagamento, valor, itens } = req.body;
      const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
      const result = await PosRepository.processQuickSale({
        tenantId: req.user!.tenantId,
        storeId: lojaId,
        items: itens,
        paymentMethod: formaPagamento,
        total: valor !== undefined ? Number(valor) : undefined,
        operatorId: req.user!.uid,
        operatorName: req.user!.name,
        idempotencyKey,
        ipAddress: req.ip
      });
      res.status(201).json(result.data);
    });

    const server = await new Promise<http.Server>((resolve) => {
      const s = testApp.listen(0, '127.0.0.1', () => resolve(s));
    });
    const addr = server.address() as any;
    const port = addr.port;

    // 1. Chamada HTTP com headers forjados para /api/v1/auth/me
    const authHttpRes = await fetch(`http://127.0.0.1:${port}/api/v1/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': validAuthHeader,
        'x-tenant-id': 'tenant-hacker',
        'x-store-id': 'store-hacker',
        'x-operator-id': 'hacker',
        'x-operator-name': 'Hacker',
        'x-operator-role': 'SUPER_ADMIN'
      }
    });
    const authHttpBody: any = await authHttpRes.json();

    // 2. Chamada HTTP com headers forjados para /api/vendas
    const saleHttpRes = await fetch(`http://127.0.0.1:${port}/api/vendas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': validAuthHeader,
        'x-tenant-id': 'tenant-hacker',
        'x-store-id': 'store-hacker',
        'x-operator-id': 'hacker',
        'x-operator-name': 'Hacker',
        'x-operator-role': 'SUPER_ADMIN',
        'idempotency-key': `forged-http-test-${Date.now()}`
      },
      body: JSON.stringify({
        lojaId: 'store-17-a',
        formaPagamento: 'PIX',
        valor: 5.00,
        itens: [{ productId: 'prod-17-idemp-a', quantity: 1 }]
      })
    });
    const saleHttpBody: any = await saleHttpRes.json();

    await new Promise<void>((resolve) => server.close(() => resolve()));

    if (!hasLiveToken) {
      delete process.env.ENABLE_TEST_AUTH;
    }

    const authMeOk = 
      authHttpRes.status === 200 &&
      authHttpBody.sucesso === true &&
      authHttpBody.user?.tenantId === 'tenant-phase17-a' &&
      authHttpBody.user?.tenantId !== 'tenant-hacker' &&
      authHttpBody.user?.role === 'OPERADOR' &&
      authHttpBody.user?.role !== 'SUPER_ADMIN' &&
      authHttpBody.user?.name !== 'Hacker' &&
      authHttpBody.user?.uid === 'user-17-a' &&
      authHttpBody.user?.uid !== 'hacker';

    const saleOrder = saleHttpBody.order || saleHttpBody.data?.order;
    const orderInDb = saleOrder?.orderId 
      ? await db.select().from(orders).where(eq(orders.orderId, saleOrder.orderId))
      : [];

    const saleOk = 
      saleHttpRes.status === 201 &&
      saleOrder?.tenantId === 'tenant-phase17-a' &&
      orderInDb.length === 1 &&
      orderInDb[0].tenantId === 'tenant-phase17-a' &&
      orderInDb[0].operatorId === 'user-17-a' &&
      orderInDb[0].operatorName !== 'Hacker';

    const passou = authMeOk && saleOk;

    const authModeName = hasLiveToken ? 'AUTENTICAÇÃO FIREBASE REAL' : 'TESTE COM AUTH FIXTURE';
    record(
      11,
      `headers forjados HTTP (${authModeName})`,
      hasLiveToken
        ? 'Camada HTTP ignora x-tenant-id, x-store-id, x-operator-* e extrai contexto exclusivamente de Firebase -> PostgreSQL -> req.user (AUTENTICAÇÃO FIREBASE REAL)'
        : 'Camada HTTP ignora x-tenant-id, x-store-id, x-operator-* e extrai contexto exclusivamente via token de fixture e PostgreSQL (TESTE COM AUTH FIXTURE)',
      passou ? 'PASS' : 'FAIL',
      'HTTP 200/201 com tenantId: tenant-phase17-a, role: OPERADOR, operator: user-17-a (headers forjados ignorados)',
      `[${authModeName}] HTTP status: ${authHttpRes.status}/${saleHttpRes.status}, tenantId na API: "${authHttpBody?.user?.tenantId}", role: "${authHttpBody?.user?.role}", orderTenant: "${saleOrder?.tenantId}"`
    );
  }

  // ===========================================================================
  // 12. ISOLAMENTO ENTRE TENANTS
  // ===========================================================================
  {
    let crossTenantProductBlocked = false;
    let crossTenantStoreBlocked = false;

    try {
      await PosRepository.processQuickSale({
        tenantId: 'tenant-phase17-a',
        storeId: 'store-17-a',
        items: [{ productId: 'prod-17-idemp-b', quantity: 1 }],
        paymentMethod: 'PIX',
        operatorId: 'user-17-a',
        operatorName: 'Operador Tenant A'
      });
    } catch (e: any) {
      if (e.message.includes('não pertence à sua organização') || e.message.includes('não encontrado')) {
        crossTenantProductBlocked = true;
      }
    }

    try {
      await PosRepository.processQuickSale({
        tenantId: 'tenant-phase17-a',
        storeId: 'store-17-b',
        items: [{ productId: 'prod-17-idemp-a', quantity: 1 }],
        paymentMethod: 'PIX',
        operatorId: 'user-17-a',
        operatorName: 'Operador Tenant A'
      });
    } catch (e: any) {
      crossTenantStoreBlocked = true;
    }

    const passou = crossTenantProductBlocked && crossTenantStoreBlocked;
    record(
      12,
      'isolamento entre tenants',
      'Tentativas de operar produtos ou lojas de outro tenant são terminantemente bloqueadas na camada de dados',
      passou ? 'PASS' : 'FAIL',
      'Ambas as tentativas rejeitadas',
      `Produto outro tenant bloqueado: ${crossTenantProductBlocked}, Loja outro tenant bloqueada: ${crossTenantStoreBlocked}`
    );
  }

  // ===========================================================================
  // 13. TESTE DE INTEGRAÇÃO FIREBASE REAL
  // ===========================================================================
  {
    const token = process.env.FIREBASE_TEST_ID_TOKEN;

    if (token && token.trim()) {
      try {
        // 1. Validação do token criptográfico no Firebase Admin
        const decoded = await adminAuth.verifyIdToken(token);
        if (!decoded || !decoded.uid) {
          throw new Error('Token verificado mas UID ausente.');
        }

        // 2. Consulta ao usuário no banco relacional PostgreSQL
        const dbUsers = await db.select().from(users).where(eq(users.uid, decoded.uid));
        if (dbUsers.length === 0) {
          throw new Error(`Usuário Firebase UID "${decoded.uid}" não encontrado no PostgreSQL.`);
        }
        const user = dbUsers[0];

        // 3. Validação de usuário ativo
        if (!user.active) {
          throw new Error(`Usuário "${decoded.uid}" desativado no PostgreSQL.`);
        }

        // 4. Validação de tenant corporativo
        if (!user.tenantId) {
          throw new Error(`Usuário "${decoded.uid}" sem tenant associado no PostgreSQL.`);
        }

        // 5. Validação de loja associada (se especificada)
        if (user.storeId) {
          const storeDb = await db.select().from(stores).where(
            and(eq(stores.storeId, user.storeId), eq(stores.tenantId, user.tenantId))
          );
          if (storeDb.length === 0) {
            throw new Error(`Loja "${user.storeId}" vinculada ao usuário não existe no tenant.`);
          }
        }

        record(
          13,
          'Firebase real',
          'Validação ponta a ponta com Firebase ID Token real emitido pelo serviço',
          'PASS',
          'Cadeia completa: verifyIdToken -> UID -> PostgreSQL -> ativo -> tenant/store válidos',
          `UID ${decoded.uid} validado, tenant: ${user.tenantId}, papel: ${user.role}, loja: ${user.storeId || 'todas'}`
        );
      } catch (err: any) {
        record(
          13,
          'Firebase real',
          'Validação ponta a ponta com Firebase ID Token real emitido pelo serviço',
          'FAIL',
          'Cadeia completa: verifyIdToken -> UID -> PostgreSQL -> ativo -> tenant/store válidos',
          `Falha na validação da cadeia Firebase: ${err.message}`
        );
      }
    } else {
      record(
        13,
        'Firebase real',
        'Validação ponta a ponta com credenciais e ID Token de usuário real do Firebase Auth',
        'SKIPPED',
        'FIREBASE_TEST_ID_TOKEN configurado no ambiente para teste de integração ao vivo',
        'FIREBASE_TEST_ID_TOKEN não configurado no ambiente; validação de ID Token testada via Admin SDK rejeitando tokens inválidos/expirados'
      );
    }
  }

  // ===========================================================================
  // RESUMO E STATUS DA FASE 1.7
  // ===========================================================================
  const total = testResults.length;
  const passed = testResults.filter(r => r.status === 'PASS').length;
  const failed = testResults.filter(r => r.status === 'FAIL').length;
  const skipped = testResults.filter(r => r.status === 'SKIPPED').length;

  console.log('\n================================================================');
  console.log(`   RESULTADO: ${passed} PASS / ${failed} FAIL / ${skipped} SKIPPED (Total: ${total})`);
  console.log('================================================================\n');

  if (failed > 0) {
    console.log(`\x1b[31mFALHAS DETECTADAS (${failed}):\x1b[0m`);
    testResults.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`- #${r.id} [${r.categoria}]: ${r.descricao}`);
      console.log(`    Esperado: ${r.esperado}`);
      console.log(`    Obtido:   ${r.obtido}`);
    });
    process.exit(1);
  } else {
    console.log('\x1b[32mTODOS OS CRITÉRIOS OBRIGATÓRIOS FORAM COMPROVADOS COM SUCESSO!\x1b[0m\n');
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('[ERRO CRÍTICO NA EXECUÇÃO DA SUÍTE]:', err);
  process.exit(1);
});
