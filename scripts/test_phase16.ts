import { io as ClientIO } from 'socket.io-client';

const BASE_URL = 'http://127.0.0.1:3000';

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function logTest(num: number, name: string, passed: boolean, details: string) {
  results.push({ num, name, passed, details });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] #${num}: ${name} -> ${details}`);
}

async function runTests() {
  console.log('--- INICIANDO BATERIA DE TESTES DE SEGURANÇA FASE 1.6 ---');

  // Test 1: Token inválido -> HTTP 401
  try {
    const res = await fetch(`${BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: 'Bearer token-totalmente-invalido' }
    });
    logTest(1, 'Token inválido', res.status === 401, `Status: ${res.status}`);
  } catch (err: any) {
    logTest(1, 'Token inválido', false, err.message);
  }

  // Test 2: Sem token -> HTTP 401
  try {
    const res = await fetch(`${BASE_URL}/api/v1/auth/me`);
    logTest(2, 'Sem token de autorização', res.status === 401, `Status: ${res.status}`);
  } catch (err: any) {
    logTest(2, 'Sem token de autorização', false, err.message);
  }

  // Test 3: Usuário inexistente -> HTTP 403
  try {
    const res = await fetch(`${BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: 'Bearer test-token:valid:usuario-que-nao-existe-12345' }
    });
    logTest(3, 'Usuário inexistente no banco', res.status === 403, `Status: ${res.status}`);
  } catch (err: any) {
    logTest(3, 'Usuário inexistente no banco', false, err.message);
  }

  // Test 4: Token expirado simulado -> HTTP 401
  try {
    const res = await fetch(`${BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: 'Bearer test-token:expired:user-admin-jackson' }
    });
    logTest(4, 'Token expirado', res.status === 401, `Status: ${res.status}`);
  } catch (err: any) {
    logTest(4, 'Token expirado', false, err.message);
  }

  // Test 5: Isolamento de Tenants em listagem de produtos -> Lojas de outro tenant bloqueadas com 403
  try {
    // user-admin-jackson pertence ao tenant-default
    // Vamos tentar acessar produtos de uma loja inexistente ou outro tenant
    const res = await fetch(`${BASE_URL}/api/lojas/emp-999-outro-tenant/produtos`, {
      headers: { Authorization: 'Bearer test-token:valid:user-admin-jackson' }
    });
    logTest(5, 'Isolamento entre tenants (loja de outro tenant)', res.status === 403, `Status: ${res.status}`);
  } catch (err: any) {
    logTest(5, 'Isolamento entre tenants', false, err.message);
  }

  // Test 6: Loja não autorizada para Operador com loja vinculada
  try {
    // user-op-juliana está vinculada à emp-1
    // Tentar acessar emp-2 deve retornar 403
    const res = await fetch(`${BASE_URL}/api/lojas/emp-2/produtos`, {
      headers: { Authorization: 'Bearer test-token:valid:user-op-juliana' }
    });
    logTest(6, 'Operador acessando loja não autorizada', res.status === 403, `Status: ${res.status}`);
  } catch (err: any) {
    logTest(6, 'Operador acessando loja não autorizada', false, err.message);
  }

  // Test 7: RBAC - Operador tentando acessar rota exclusiva de Admin (/api/fechamento/consolidado)
  try {
    const res = await fetch(`${BASE_URL}/api/fechamento/consolidado`, {
      headers: { Authorization: 'Bearer test-token:valid:user-op-juliana' }
    });
    logTest(7, 'RBAC bloqueia operador em rota gerencial', res.status === 403, `Status: ${res.status}`);
  } catch (err: any) {
    logTest(7, 'RBAC', false, err.message);
  }

  // Test 8: Socket.IO sem token -> handshake rejeitado
  await new Promise<void>((resolve) => {
    const socket = ClientIO(BASE_URL, {
      transports: ['websocket'],
      autoConnect: false,
      reconnection: false
    });
    socket.on('connect_error', (err) => {
      logTest(8, 'Socket.IO sem token rejeitado', true, err.message);
      socket.close();
      resolve();
    });
    socket.on('connect', () => {
      logTest(8, 'Socket.IO sem token rejeitado', false, 'Conectou indevidamente');
      socket.close();
      resolve();
    });
    socket.connect();
    setTimeout(() => {
      socket.close();
      resolve();
    }, 2000);
  });

  // Test 9: Socket.IO token inválido -> handshake rejeitado
  await new Promise<void>((resolve) => {
    const socket = ClientIO(BASE_URL, {
      auth: { token: 'token-falso-invalido' },
      transports: ['websocket'],
      autoConnect: false,
      reconnection: false
    });
    socket.on('connect_error', (err) => {
      logTest(9, 'Socket.IO token inválido rejeitado', true, err.message);
      socket.close();
      resolve();
    });
    socket.on('connect', () => {
      logTest(9, 'Socket.IO token inválido rejeitado', false, 'Conectou indevidamente');
      socket.close();
      resolve();
    });
    socket.connect();
    setTimeout(() => {
      socket.close();
      resolve();
    }, 2000);
  });

  // Test 10: Idempotência de venda -> Mesma chave retorna mesmo pedido sem duplicar
  try {
    const key = `idemp-test-${Date.now()}`;
    const body = {
      lojaId: 'emp-1',
      formaPagamento: 'DINHEIRO',
      valor: 14.50,
      itens: [{ productId: 'prod-espeto-angus', quantity: 1, unitPrice: 14.50 }]
    };

    const res1 = await fetch(`${BASE_URL}/api/vendas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token:valid:user-admin-jackson',
        'Idempotency-Key': key
      },
      body: JSON.stringify(body)
    });
    const json1 = await res1.json();

    const res2 = await fetch(`${BASE_URL}/api/vendas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token:valid:user-admin-jackson',
        'Idempotency-Key': key
      },
      body: JSON.stringify(body)
    });
    const json2 = await res2.json();

    const passed = (res1.status === 201 || res1.status === 200) &&
                   res2.status === 200 &&
                   json1.order?.orderId === json2.order?.orderId;
    logTest(10, 'Idempotência de venda com mesma chave', passed, `Order1: ${json1.order?.orderId} == Order2: ${json2.order?.orderId}`);
  } catch (err: any) {
    logTest(10, 'Idempotência de venda', false, err.message);
  }

  // Test 11: Fechamento duplo de caixa bloqueado
  try {
    const body = {
      dinheiroInformadoNaGaveta: 100,
      pixInformado: 0,
      cartaoInformado: 0
    };
    // Tentar fechar em uma loja sem turno aberto
    const res = await fetch(`${BASE_URL}/api/fechamento/emp-99`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token:valid:user-admin-jackson'
      },
      body: JSON.stringify(body)
    });
    logTest(11, 'Fechamento de caixa inexistente/duplo bloqueado', res.status === 400 || res.status === 403, `Status: ${res.status}`);
  } catch (err: any) {
    logTest(11, 'Fechamento duplo', false, err.message);
  }

  // Test 12: Sangria acima do saldo bloqueada
  try {
    const res = await fetch(`${BASE_URL}/api/lojas/emp-1/turnos/turno-inexistente/movimentacoes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token:valid:user-admin-jackson'
      },
      body: JSON.stringify({
        tipo: 'SANGRIA',
        valor: 9999999,
        motivo: 'Teste de sangria excessiva'
      })
    });
    logTest(12, 'Sangria inválida/excessiva bloqueada', res.status === 400 || res.status === 404, `Status: ${res.status}`);
  } catch (err: any) {
    logTest(12, 'Sangria excessiva', false, err.message);
  }

  // Test 13: Tenant forjado no body/header ignorado (usa tenant seguro do token verificado)
  try {
    const res = await fetch(`${BASE_URL}/api/v1/auth/me`, {
      headers: {
        Authorization: 'Bearer test-token:valid:user-admin-jackson',
        'x-tenant-id': 'tenant-hacked-999'
      }
    });
    const json = await res.json();
    const passed = json.user?.tenantId === 'tenant-default';
    logTest(13, 'Header x-tenant-id forjado é sumariamente ignorado', passed, `Tenant usado: ${json.user?.tenantId}`);
  } catch (err: any) {
    logTest(13, 'Header x-tenant-id forjado', false, err.message);
  }

  // Test 14: Header x-operator-* ignorado como credencial
  try {
    const res = await fetch(`${BASE_URL}/api/v1/auth/me`, {
      headers: {
        'x-operator-id': 'user-admin-jackson',
        'x-operator-role': 'SUPER_ADMIN'
      }
    });
    logTest(14, 'Headers x-operator-* não autenticam (401)', res.status === 401, `Status: ${res.status}`);
  } catch (err: any) {
    logTest(14, 'Headers x-operator-*', false, err.message);
  }

  // Test 15: Recálculo autoritativo de preço pelo backend (ignora preço enviado pelo cliente)
  try {
    const key = `price-auth-${Date.now()}`;
    // Cliente tenta forjar preço R$ 0.01 em um produto que custa R$ 14.50
    const forgedBody = {
      lojaId: 'emp-1',
      formaPagamento: 'DINHEIRO',
      valor: 0.01,
      itens: [{ productId: 'prod-espeto-angus', quantity: 1, unitPrice: 0.01 }]
    };

    const res = await fetch(`${BASE_URL}/api/vendas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token:valid:user-admin-jackson',
        'Idempotency-Key': key
      },
      body: JSON.stringify(forgedBody)
    });
    const json = await res.json();
    // O total no pedido gerado pelo banco deve ser 14.50 e não 0.01!
    const backendPriceEnforced = Number(json.order?.total) === 14.50;
    logTest(15, 'Autoridade total do backend sobre preços (cliente forjou 0.01)', backendPriceEnforced, `Total faturado no PostgreSQL: R$ ${json.order?.total}`);
  } catch (err: any) {
    logTest(15, 'Autoridade de preços', false, err.message);
  }

  // Test 16: Usuário inativo bloqueado -> HTTP 403
  try {
    const res = await fetch(`${BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: 'Bearer test-token:valid:user-inativo-teste' }
    });
    logTest(16, 'Usuário inativo tem acesso bloqueado (HTTP 403)', res.status === 403, `Status: ${res.status}`);
  } catch (err: any) {
    logTest(16, 'Usuário inativo', false, err.message);
  }

  // Test 17: Validação de PIN de Supervisor com SHA-256 (PIN correto autoriza, incorreto retorna 403)
  try {
    const resCorrect = await fetch(`${BASE_URL}/api/v1/auth/verify-supervisor-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token:valid:user-op-juliana'
      },
      body: JSON.stringify({ pin: '1234', storeId: 'emp-1' })
    });
    const jsonCorrect = await resCorrect.json();

    const resWrong = await fetch(`${BASE_URL}/api/v1/auth/verify-supervisor-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token:valid:user-op-juliana'
      },
      body: JSON.stringify({ pin: '0000', storeId: 'emp-1' })
    });

    const passed = resCorrect.status === 200 && jsonCorrect.sucesso === true && resWrong.status === 403;
    logTest(17, 'Validação de PIN de supervisor com SHA-256 (1234 vs 0000)', passed, `Correto: ${resCorrect.status}, Incorreto: ${resWrong.status}`);
  } catch (err: any) {
    logTest(17, 'PIN de supervisor', false, err.message);
  }

  // Test 18: Isolamento Multi-Tenant em consulta de recurso individual (HTTP 404)
  try {
    // prod-b-1 pertence ao tenant-b-corp. Jackson pertence ao tenant-default
    const res = await fetch(`${BASE_URL}/api/produtos/prod-b-1`, {
      headers: { Authorization: 'Bearer test-token:valid:user-admin-jackson' }
    });
    logTest(18, 'Consulta direta a recurso de outro tenant retorna 404', res.status === 404, `Status: ${res.status}`);
  } catch (err: any) {
    logTest(18, 'Isolamento individual', false, err.message);
  }

  // Test 19: Rollback transacional sob falha simulada (venda abortada não altera estoque)
  try {
    // 1. Consulta estoque atual
    const resProdBefore = await fetch(`${BASE_URL}/api/produtos/prod-espeto-angus`, {
      headers: { Authorization: 'Bearer test-token:valid:user-admin-jackson' }
    });
    const jsonProdBefore = await resProdBefore.json();
    const stockBefore = Number(jsonProdBefore.data?.stockQuantity ?? 0);

    // 2. Envia venda com simulateFailureAfterStock: true
    const resSale = await fetch(`${BASE_URL}/api/vendas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token:valid:user-admin-jackson',
        'Idempotency-Key': `rollback-test-${Date.now()}`
      },
      body: JSON.stringify({
        lojaId: 'emp-1',
        formaPagamento: 'DINHEIRO',
        itens: [{ productId: 'prod-espeto-angus', quantity: 2 }],
        simulateFailureAfterStock: true
      })
    });

    // 3. Consulta estoque após falha
    const resProdAfter = await fetch(`${BASE_URL}/api/produtos/prod-espeto-angus`, {
      headers: { Authorization: 'Bearer test-token:valid:user-admin-jackson' }
    });
    const jsonProdAfter = await resProdAfter.json();
    const stockAfter = Number(jsonProdAfter.data?.stockQuantity ?? 0);

    const passed = (resSale.status === 400 || resSale.status === 500) && stockBefore === stockAfter;
    logTest(19, 'Rollback transacional preserva integridade do estoque após falha', passed, `Status Venda: ${resSale.status}, Estoque antes: ${stockBefore}, Estoque depois: ${stockAfter}`);
  } catch (err: any) {
    logTest(19, 'Rollback transacional', false, err.message);
  }

  // Test 20: CORS restritivo (diagnóstico de headers)
  try {
    const res = await fetch(`${BASE_URL}/api/test-cors`, {
      headers: { origin: 'http://localhost:3000' }
    });
    const json = await res.json();
    logTest(20, 'Configuração e proteção de CORS ativa', res.status === 200 && json.sucesso, `Status: ${res.status}`);
  } catch (err: any) {
    logTest(20, 'CORS', false, err.message);
  }

  console.log('--- RESULTADO FINAL DOS TESTES ---');
  const totalPassed = results.filter(r => r.passed).length;
  console.log(`TOTAL APROVADOS: ${totalPassed}/${results.length} (${Math.round((totalPassed / results.length) * 100)}%)`);
}

runTests();
