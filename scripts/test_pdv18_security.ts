/**
 * SUÍTE DE TESTES AUTOMATIZADOS - SEGURANÇA E AUTORIZAÇÃO PDV 1.1
 * 
 * Validação rigorosa dos 13 requisitos mandatórios (TESTE A ao TESTE M):
 * TESTE A: Usuário sem storeId acessando uma loja -> Esperado: 403
 * TESTE B: Usuário da Loja A acessando Loja B -> Esperado: 403
 * TESTE C: Usuário do Tenant A acessando loja do Tenant B -> Esperado: 403
 * TESTE D: FINANCEIRO tentando POST /api/vendas -> Esperado: 403
 * TESTE E: ESTOQUISTA tentando POST /api/vendas -> Esperado: 403
 * TESTE F: CAIXA vendendo na própria loja -> Esperado: Sucesso (201)
 * TESTE G: OPERADOR vendendo na própria loja -> Esperado: Sucesso (201)
 * TESTE H: Operador da Loja A tentando validar PIN de supervisor da Loja B -> Esperado: 403
 * TESTE I: Preço adulterado pelo frontend -> Esperado: Backend ignora preço adulterado e usa preço oficial do banco
 * TESTE J: Mesmo Idempotency-Key enviado duas vezes -> Esperado: Somente uma venda
 * TESTE K: Duas vendas concorrentes consumindo o mesmo estoque -> Esperado: Estoque nunca fica negativo
 * TESTE L: Falha depois da baixa do estoque -> Esperado: ROLLBACK e estoque restaurado
 * TESTE M: SUPER_ADMIN tentando acessar loja de outro tenant sem autorização global explícita -> Esperado: 403
 */

import http from 'http';
import { db } from '../src/db/index.ts';
import { storeInventories, products, orders } from '../src/db/schema.ts';
import { eq, and } from 'drizzle-orm';
import { createSecurityTestApp } from '../src/tests/fixtures/testServer.ts';
import { seedDatabase } from '../src/db/seed.ts';

interface TestResult {
  letra: string;
  nome: string;
  esperado: string;
  obtido: string;
  passou: boolean;
  detalhes?: string;
}

const results: TestResult[] = [];

async function runSecuritySuite() {
  console.log('================================================================');
  console.log(' SUÍTE DE SEGURANÇA E HARDENING PDV 1.1 - TESTES A ATÉ M');
  console.log('================================================================\n');

  // Configuração do ambiente de teste
  process.env.NODE_ENV = 'test';
  process.env.ENABLE_TEST_AUTH = 'true';
  await seedDatabase();

  // Inicializa servidor express de testes isolado
  const testApp = createSecurityTestApp();
  const testServer = await new Promise<http.Server>((resolve) => {
    const s = testApp.listen(0, '127.0.0.1', () => resolve(s));
  });
  const testPort = (testServer.address() as any).port;
  const BASE_URL = `http://127.0.0.1:${testPort}`;

  try {
    // -------------------------------------------------------------------------
    // TESTE A: Usuário sem storeId acessando uma loja -> Esperado: 403
    // -------------------------------------------------------------------------
    {
      const res = await fetch(`${BASE_URL}/api/lojas/emp-1/produtos`, {
        headers: { 'Authorization': 'Bearer test-token:valid:user-op-nostore' }
      });
      const data = await res.json();
      const passou = res.status === 403 && (data.erro?.includes('não possui unidade vinculada') || data.erro?.includes('Acesso negado'));
      results.push({
        letra: 'A',
        nome: 'Usuário sem storeId acessando uma loja',
        esperado: 'HTTP 403 Forbidden (Acesso negado)',
        obtido: `HTTP ${res.status}: ${data.erro}`,
        passou
      });
    }

    // -------------------------------------------------------------------------
    // TESTE B: Usuário da Loja A acessando Loja B -> Esperado: 403
    // -------------------------------------------------------------------------
    {
      // Juliana pertence à loja emp-1. Tenta acessar a loja emp-2
      const res = await fetch(`${BASE_URL}/api/lojas/emp-2/produtos`, {
        headers: { 'Authorization': 'Bearer test-token:valid:user-op-juliana' }
      });
      const data = await res.json();
      const passou = res.status === 403 && (data.erro?.includes('não pode acessar') || data.erro?.includes('não pode operar') || data.erro?.includes('Acesso negado'));
      results.push({
        letra: 'B',
        nome: 'Usuário da Loja A acessando Loja B',
        esperado: 'HTTP 403 Forbidden (Isolamento de Loja)',
        obtido: `HTTP ${res.status}: ${data.erro}`,
        passou
      });
    }

    // -------------------------------------------------------------------------
    // TESTE C: Usuário do Tenant A acessando loja do Tenant B -> Esperado: 403
    // -------------------------------------------------------------------------
    {
      // user-caixa-lucas pertence a tenant-default. Tenta acessar emp-b-1 (pertencente a tenant-b-corp)
      const res = await fetch(`${BASE_URL}/api/lojas/emp-b-1/produtos`, {
        headers: { 'Authorization': 'Bearer test-token:valid:user-caixa-lucas' }
      });
      const data = await res.json();
      const passou = res.status === 403 && (data.erro?.includes('Acesso negado') || data.erro?.includes('Tenant mismatch') || data.erro?.includes('não pertence'));
      results.push({
        letra: 'C',
        nome: 'Usuário do Tenant A acessando loja do Tenant B',
        esperado: 'HTTP 403 Forbidden (Isolamento Multi-Tenant estrito)',
        obtido: `HTTP ${res.status}: ${data.erro}`,
        passou
      });
    }

    // -------------------------------------------------------------------------
    // TESTE D: FINANCEIRO tentando POST /api/vendas -> Esperado: 403
    // -------------------------------------------------------------------------
    {
      const res = await fetch(`${BASE_URL}/api/vendas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token:valid:user-fin-marcos'
        },
        body: JSON.stringify({
          lojaId: 'emp-1',
          formaPagamento: 'DINHEIRO',
          itens: [{ productId: 'prod-espeto-angus', quantity: 1 }]
        })
      });
      const data = await res.json();
      const passou = res.status === 403 && (data.erro?.includes('Acesso negado') || data.erro?.includes('permissão'));
      results.push({
        letra: 'D',
        nome: 'Usuário FINANCEIRO tentando POST /api/vendas',
        esperado: 'HTTP 403 Forbidden (RBAC - Bloqueio de Perfil Financeiro)',
        obtido: `HTTP ${res.status}: ${data.erro}`,
        passou
      });
    }

    // -------------------------------------------------------------------------
    // TESTE E: ESTOQUISTA tentando POST /api/vendas -> Esperado: 403
    // -------------------------------------------------------------------------
    {
      const res = await fetch(`${BASE_URL}/api/vendas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token:valid:user-est-roberto'
        },
        body: JSON.stringify({
          lojaId: 'emp-1',
          formaPagamento: 'DINHEIRO',
          itens: [{ productId: 'prod-espeto-angus', quantity: 1 }]
        })
      });
      const data = await res.json();
      const passou = res.status === 403 && (data.erro?.includes('Acesso negado') || data.erro?.includes('permissão'));
      results.push({
        letra: 'E',
        nome: 'Usuário ESTOQUISTA tentando POST /api/vendas',
        esperado: 'HTTP 403 Forbidden (RBAC - Bloqueio de Perfil Estoquista)',
        obtido: `HTTP ${res.status}: ${data.erro}`,
        passou
      });
    }

    // -------------------------------------------------------------------------
    // TESTE F: CAIXA vendendo na própria loja -> Esperado: sucesso (201)
    // -------------------------------------------------------------------------
    {
      const res = await fetch(`${BASE_URL}/api/vendas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token:valid:user-caixa-lucas',
          'idempotency-key': `venda-caixa-${Date.now()}`
        },
        body: JSON.stringify({
          lojaId: 'emp-1',
          formaPagamento: 'DINHEIRO',
          itens: [{ productId: 'prod-espeto-angus', quantity: 1 }]
        })
      });
      const data = await res.json();
      const orderId = data.venda?.orderId || data.order?.orderId;
      const passou = res.status === 201 && data.sucesso === true && Boolean(orderId);
      results.push({
        letra: 'F',
        nome: 'Usuário CAIXA vendendo na própria loja',
        esperado: 'HTTP 201 Created (Venda realizada com sucesso)',
        obtido: `HTTP ${res.status}: Sucesso=${data.sucesso}, OrderId=${orderId} (Erro: ${data.erro || 'nenhum'})`,
        passou
      });
    }

    // -------------------------------------------------------------------------
    // TESTE G: OPERADOR vendendo na própria loja -> Esperado: sucesso (201)
    // -------------------------------------------------------------------------
    {
      const res = await fetch(`${BASE_URL}/api/vendas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token:valid:user-op-juliana',
          'idempotency-key': `venda-operador-${Date.now()}`
        },
        body: JSON.stringify({
          lojaId: 'emp-1',
          formaPagamento: 'DINHEIRO',
          itens: [{ productId: 'prod-espeto-angus', quantity: 1 }]
        })
      });
      const data = await res.json();
      const orderId = data.venda?.orderId || data.order?.orderId;
      const passou = res.status === 201 && data.sucesso === true && Boolean(orderId);
      results.push({
        letra: 'G',
        nome: 'Usuário OPERADOR vendendo na própria loja',
        esperado: 'HTTP 201 Created (Venda realizada com sucesso)',
        obtido: `HTTP ${res.status}: Sucesso=${data.sucesso}, OrderId=${orderId} (Erro: ${data.erro || 'nenhum'})`,
        passou
      });
    }

    // -------------------------------------------------------------------------
    // TESTE H: Operador da Loja A tentando validar PIN de supervisor da Loja B -> Esperado: 403
    // -------------------------------------------------------------------------
    {
      // Caso 1: Operador da Loja emp-1 tenta validar informando storeId emp-2
      const res1 = await fetch(`${BASE_URL}/api/v1/auth/verify-supervisor-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token:valid:user-op-juliana'
        },
        body: JSON.stringify({
          storeId: 'emp-2',
          pin: '654321' // PIN do gerente da Loja 2
        })
      });
      const data1 = await res1.json();

      // Caso 2: Operador da Loja emp-1 informa storeId emp-1, mas usa o PIN do gerente da Loja 2
      const res2 = await fetch(`${BASE_URL}/api/v1/auth/verify-supervisor-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token:valid:user-op-juliana'
        },
        body: JSON.stringify({
          storeId: 'emp-1',
          pin: '654321' // Gerente Paulo da Loja 1 tem PIN 482910; 654321 é da Loja 2!
        })
      });
      const data2 = await res2.json();

      const passou = res1.status === 403 && data1.erro === 'Autorização não permitida.' &&
                     res2.status === 403 && data2.erro === 'Autorização não permitida.';

      results.push({
        letra: 'H',
        nome: 'Operador da Loja A tentando validar PIN de supervisor da Loja B',
        esperado: 'HTTP 403 Forbidden (Autorização não permitida. Sem vazamento de dados)',
        obtido: `Caso 1: HTTP ${res1.status} (${data1.erro}) | Caso 2: HTTP ${res2.status} (${data2.erro})`,
        passou
      });
    }

    // -------------------------------------------------------------------------
    // TESTE I: Preço adulterado pelo frontend -> Esperado: backend usa preço oficial
    // -------------------------------------------------------------------------
    {
      // Produto prod-espeto-angus possui salePrice = 14.00 no banco.
      // Frontend envia unitPrice adulterado para 1.00 e total 2.00 para 2 unidades.
      const res = await fetch(`${BASE_URL}/api/vendas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token:valid:user-caixa-lucas',
          'idempotency-key': `tamper-price-${Date.now()}`
        },
        body: JSON.stringify({
          lojaId: 'emp-1',
          formaPagamento: 'DINHEIRO',
          valor: 2.00, // Adulterado
          itens: [{ productId: 'prod-espeto-angus', quantity: 2, unitPrice: 1.00 }] // Adulterado
        })
      });
      const data = await res.json();
      const totalCalculado = Number(data.order?.total || data.venda?.total);
      // Backend recalcula com base na tabela oficial: 2 * 14.50 = 29.00
      const passou = res.status === 201 && totalCalculado === 29.00;
      results.push({
        letra: 'I',
        nome: 'Preço adulterado pelo frontend (Integridade Financeira)',
        esperado: 'Backend ignora preço do payload (1.00) e calcula 29.00 (2x R$ 14.50)',
        obtido: `HTTP ${res.status}: Total registrado = R$ ${totalCalculado}`,
        passou
      });
    }

    // -------------------------------------------------------------------------
    // TESTE J: Mesmo Idempotency-Key enviado duas vezes -> Esperado: somente uma venda
    // -------------------------------------------------------------------------
    {
      const idempotencyKey = `idemp-teste-j-${Date.now()}`;
      const payload = {
        lojaId: 'emp-1',
        formaPagamento: 'DINHEIRO',
        itens: [{ productId: 'prod-espeto-angus', quantity: 1 }]
      };

      const [res1, res2] = await Promise.all([
        fetch(`${BASE_URL}/api/vendas`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token:valid:user-caixa-lucas',
            'idempotency-key': idempotencyKey
          },
          body: JSON.stringify(payload)
        }),
        fetch(`${BASE_URL}/api/vendas`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token:valid:user-caixa-lucas',
            'idempotency-key': idempotencyKey
          },
          body: JSON.stringify(payload)
        })
      ]);

      const [data1, data2] = await Promise.all([res1.json(), res2.json()]);
      const orderId1 = data1.order?.orderId || data1.venda?.orderId;
      const orderId2 = data2.order?.orderId || data2.venda?.orderId;

      // Verifica no banco se existe apenas 1 pedido gerado com este orderId
      const ordersInDb = await db.select().from(orders).where(eq(orders.orderId, orderId1));
      const statusCorretos = (res1.status === 201 && res2.status === 200) || (res1.status === 200 && res2.status === 201);
      const passou = Boolean(orderId1) && (orderId1 === orderId2) && ordersInDb.length === 1 && statusCorretos;

      results.push({
        letra: 'J',
        nome: 'Mesmo Idempotency-Key enviado duas vezes (Idempotência Estrita)',
        esperado: 'Apenas 1 pedido registrado no PostgreSQL com o mesmo orderId retornado',
        obtido: `Status: [${res1.status}, ${res2.status}], Pedidos no banco: ${ordersInDb.length}, OrderIds: [${orderId1}, ${orderId2}]`,
        passou
      });
    }

    // -------------------------------------------------------------------------
    // TESTE K: Duas vendas concorrentes consumindo o mesmo estoque -> Esperado: estoque nunca fica negativo
    // -------------------------------------------------------------------------
    {
      // Reseta o estoque de prod-concorrencia-estoque na loja emp-1 para exatamente 1
      await db.update(storeInventories)
        .set({ currentStock: 1 })
        .where(and(
          eq(storeInventories.storeId, 'emp-1'),
          eq(storeInventories.productId, 'prod-concorrencia-estoque')
        ));

      // Duas requisições simultâneas tentando consumir 1 unidade cada
      const [reqA, reqB] = await Promise.all([
        fetch(`${BASE_URL}/api/vendas`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token:valid:user-caixa-lucas',
            'idempotency-key': `stock-conc-A-${Date.now()}`
          },
          body: JSON.stringify({
            lojaId: 'emp-1',
            formaPagamento: 'DINHEIRO',
            itens: [{ productId: 'prod-concorrencia-estoque', quantity: 1 }]
          })
        }),
        fetch(`${BASE_URL}/api/vendas`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token:valid:user-op-juliana',
            'idempotency-key': `stock-conc-B-${Date.now()}`
          },
          body: JSON.stringify({
            lojaId: 'emp-1',
            formaPagamento: 'DINHEIRO',
            itens: [{ productId: 'prod-concorrencia-estoque', quantity: 1 }]
          })
        })
      ]);

      const [resA, resB] = await Promise.all([reqA.json(), reqB.json()]);

      // Verifica estoque final no PostgreSQL
      const [finalInv] = await db.select().from(storeInventories).where(and(
        eq(storeInventories.storeId, 'emp-1'),
        eq(storeInventories.productId, 'prod-concorrencia-estoque')
      ));

      const estoqueFinal = finalInv ? finalInv.currentStock : -99;
      // Um request deve ter tido sucesso (201) e o outro falhado (400 - Estoque insuficiente).
      // O estoque final DEVE ser 0 e NUNCA negativo!
      const exatamenteUmSucesso = (reqA.status === 201 && reqB.status === 400) || (reqB.status === 201 && reqA.status === 400);
      const estoqueNaoNegativo = estoqueFinal === 0;
      const passou = exatamenteUmSucesso && estoqueNaoNegativo;

      results.push({
        letra: 'K',
        nome: 'Duas vendas concorrentes consumindo mesmo estoque (FOR UPDATE & Concorrência)',
        esperado: 'Exatamente 1 venda aprovada (201), 1 rejeitada (400), estoque final = 0 (nunca negativo)',
        obtido: `Status: [${reqA.status}, ${reqB.status}], Estoque final no banco = ${estoqueFinal}`,
        passou
      });
    }

    // -------------------------------------------------------------------------
    // TESTE L: Falha depois da baixa do estoque -> Esperado: ROLLBACK e estoque restaurado
    // -------------------------------------------------------------------------
    {
      // Reseta o estoque de prod-rollback-teste para 10
      await db.update(storeInventories)
        .set({ currentStock: 10 })
        .where(and(
          eq(storeInventories.storeId, 'emp-1'),
          eq(storeInventories.productId, 'prod-rollback-teste')
        ));

      // Dispara venda simulando falha atômica após baixa do estoque
      const res = await fetch(`${BASE_URL}/api/vendas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token:valid:user-caixa-lucas',
          'idempotency-key': `rollback-key-${Date.now()}`
        },
        body: JSON.stringify({
          lojaId: 'emp-1',
          formaPagamento: 'DINHEIRO',
          itens: [{ productId: 'prod-rollback-teste', quantity: 3 }],
          simulateFailureAfterStock: true
        })
      });

      // Confere estoque final após a transação
      const [invApos] = await db.select().from(storeInventories).where(and(
        eq(storeInventories.storeId, 'emp-1'),
        eq(storeInventories.productId, 'prod-rollback-teste')
      ));

      const estoquePreservado = invApos?.currentStock === 10;
      const falhouComoEsperado = res.status === 500;
      const passou = falhouComoEsperado && estoquePreservado;

      results.push({
        letra: 'L',
        nome: 'Falha depois da baixa do estoque (Transação Atômica & ROLLBACK)',
        esperado: 'HTTP 500 com ROLLBACK completo: estoque permanece 10 (intacto)',
        obtido: `HTTP ${res.status}, Estoque final no banco = ${invApos?.currentStock}`,
        passou
      });
    }

    // -------------------------------------------------------------------------
    // TESTE M: SUPER_ADMIN tentando acessar loja de outro tenant sem autorização global explícita -> Esperado: 403
    // -------------------------------------------------------------------------
    {
      // user-superadmin-global pertence ao tenant-default. Tenta acessar emp-b-1 de tenant-b-corp sem flag global
      const res = await fetch(`${BASE_URL}/api/lojas/emp-b-1/produtos`, {
        headers: { 'Authorization': 'Bearer test-token:valid:user-superadmin-global' }
      });
      const data = await res.json();
      const passou = res.status === 403 && (data.erro?.includes('Acesso negado') || data.erro?.includes('não pertence'));

      results.push({
        letra: 'M',
        nome: 'SUPER_ADMIN acessando loja de outro tenant sem autorização global explícita',
        esperado: 'HTTP 403 Forbidden (Isolamento de tenant estrito mesmo para SUPER_ADMIN)',
        obtido: `HTTP ${res.status}: ${data.erro}`,
        passou
      });
    }

    // -------------------------------------------------------------------------
    // RELATÓRIO FINAL FORMATADO
    // -------------------------------------------------------------------------
    console.log('\n----------------------------------------------------------------');
    console.log(' TABELA DE RESULTADOS DOS 13 TESTES DE SEGURANÇA MANDATÓRIOS (A - M)');
    console.log('----------------------------------------------------------------');

    let passCount = 0;
    for (const r of results) {
      const icon = r.passou ? '✅ PASSOU' : '❌ FALHOU';
      if (r.passou) passCount++;
      console.log(`[TESTE ${r.letra}] ${icon} | ${r.nome}`);
      console.log(`          Esperado: ${r.esperado}`);
      console.log(`          Obtido:   ${r.obtido}\n`);
    }

    console.log('================================================================');
    console.log(` PLACAR GERAL: ${passCount} / ${results.length} TESTES APROVADOS (${Math.round((passCount / results.length) * 100)}%)`);
    console.log('================================================================');

    testServer.close();

    if (passCount === results.length) {
      console.log('🎉 TODOS OS 13 TESTES DE SEGURANÇA E AUTORIZAÇÃO FORAM HOMOLOGADOS COM 100% DE SUCESSO!');
      process.exit(0);
    } else {
      console.error(`⚠️ ATENÇÃO: ${results.length - passCount} testes falharam.`);
      process.exit(1);
    }
  } catch (err) {
    testServer.close();
    console.error('Erro inesperado durante a execução da suíte:', err);
    process.exit(1);
  }
}

runSecuritySuite();
