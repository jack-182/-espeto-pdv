/**
 * SUÍTE DE TESTES: FLUXO DE CADASTRO E CONVITE DE FUNCIONÁRIOS (PERFIL OPERADOR)
 * Valida todas as regras de negócio, RBAC, isolamento multi-tenant, auditoria e aceitação de convite.
 */

process.env.NODE_ENV = 'test';
process.env.ENABLE_TEST_AUTH = 'true';

import http from 'http';
import { db } from '../src/db/index.ts';
import { users, stores, userInvitations, auditLogs } from '../src/db/schema.ts';
import { eq, and } from 'drizzle-orm';
import { createSecurityTestApp } from '../src/tests/fixtures/testServer.ts';

let BASE_URL = '';

interface TestResult {
  num: number;
  nome: string;
  esperado: string;
  obtido: string;
  passou: boolean;
  detalhes?: string;
}

const results: TestResult[] = [];

async function httpRequest(
  method: string,
  path: string,
  body?: any,
  token?: string
): Promise<{ status: number; body: any }> {
  const url = new URL(path, BASE_URL);
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      url,
      {
        method,
        headers
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const parsed = raw ? JSON.parse(raw) : null;
            resolve({ status: res.statusCode || 500, body: parsed });
          } catch {
            resolve({ status: res.statusCode || 500, body: raw });
          }
        });
      }
    );

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log(' TESTES DO FLUXO DE CADASTRO E CONVITE DE FUNCIONÁRIOS OPERADOR');
  console.log('================================================================\n');

  // Inicializa servidor de testes
  const app = createSecurityTestApp();
  const server = app.listen(0);
  const port = (server.address() as any).port;
  BASE_URL = `http://127.0.0.1:${port}`;

  try {
    // 1. Setup: Garante existência de lojas para o tenant
    const store1 = await db.select().from(stores).where(eq(stores.storeId, 'store-1-emp'));
    if (store1.length === 0) {
      await db.insert(stores).values({
        storeId: 'store-1-emp',
        tenantId: 'tenant-default',
        tradeName: 'Espetinho Unidade Central',
        corporateName: 'Espetinho LTDA',
        cnpj: '11.111.111/0001-11',
        segment: 'ESPETINHO',
        address: 'Rua Principal, 100',
        phone: '(11) 98888-0001'
      });
    }

    const store2 = await db.select().from(stores).where(eq(stores.storeId, 'store-2-emp'));
    if (store2.length === 0) {
      await db.insert(stores).values({
        storeId: 'store-2-emp',
        tenantId: 'tenant-default',
        tradeName: 'Espetinho Unidade Bairro',
        corporateName: 'Espetinho Filial LTDA',
        cnpj: '11.111.111/0002-22',
        segment: 'ESPETINHO',
        address: 'Av. das Flores, 200',
        phone: '(11) 98888-0002'
      });
    }

    // Garante que o administrador existe
    const adminUser = await db.select().from(users).where(eq(users.uid, 'admin-master-uid'));
    if (adminUser.length === 0) {
      await db.insert(users).values({
        uid: 'admin-master-uid',
        tenantId: 'tenant-default',
        name: 'Administrador Geral',
        email: 'admin@empresa.com.br',
        role: 'ADMINISTRADOR',
        active: true
      });
    }

    // Garante que o operador existe
    const opUser = await db.select().from(users).where(eq(users.uid, 'user-test-operator'));
    if (opUser.length === 0) {
      await db.insert(users).values({
        uid: 'user-test-operator',
        tenantId: 'tenant-default',
        storeId: 'store-1-emp',
        name: 'Operador Teste Existente',
        email: 'op.existente@empresa.com.br',
        role: 'OPERADOR',
        active: true
      });
    }

    // Formato de token de teste aceito por testAuth.ts: test-token:valid:<uid>
    const adminToken = 'test-token:valid:admin-master-uid';
    const operatorToken = 'test-token:valid:user-test-operator';

    // ------------------------------------------------------------------------
    // TESTE 1: Administrador cadastra novo funcionário com perfil OPERADOR
    // ------------------------------------------------------------------------
    const empEmail = `operador.teste.${Date.now()}@empresa.com.br`;
    const res1 = await httpRequest(
      'POST',
      '/api/v1/employees',
      {
        nome: 'João da Silva Operador',
        email: empEmail,
        lojaId: 'store-1-emp',
        status: 'ACTIVE'
      },
      adminToken
    );

    const passou1 = res1.status === 201 && 
      res1.body?.sucesso === true && 
      res1.body?.data?.role === 'OPERADOR' &&
      res1.body?.data?.convite?.token;

    results.push({
      num: 1,
      nome: 'Administrador cadastra funcionário (perfil OPERADOR forçado e convite gerado)',
      esperado: 'HTTP 201 com role OPERADOR e token de convite',
      obtido: `HTTP ${res1.status}, role: ${res1.body?.data?.role}, convite: ${!!res1.body?.data?.convite?.token}`,
      passou: !!passou1
    });

    const createdEmployeeId = res1.body?.data?.id;
    const invitationToken = res1.body?.data?.convite?.token;

    // ------------------------------------------------------------------------
    // TESTE 2: Rejeição se o frontend enviar role diferente de OPERADOR (Regra 9)
    // ------------------------------------------------------------------------
    const res2 = await httpRequest(
      'POST',
      '/api/v1/employees',
      {
        nome: 'Tentativa Invasor Admin',
        email: `hacker.${Date.now()}@empresa.com.br`,
        lojaId: 'store-1-emp',
        role: 'ADMINISTRADOR',
        status: 'ACTIVE'
      },
      adminToken
    );

    const passou2 = (res2.status === 400 || res2.status === 422) && res2.body?.sucesso === false;
    results.push({
      num: 2,
      nome: 'Bloqueio estrito de payload contendo role ADMINISTRADOR (Regra 9)',
      esperado: 'HTTP 400/422 Bad Request rejeitando role não-OPERADOR',
      obtido: `HTTP ${res2.status}: ${res2.body?.erro}`,
      passou: passou2
    });

    // ------------------------------------------------------------------------
    // TESTE 3: Bloqueio de acesso se um OPERADOR tentar cadastrar funcionários (Regra 8)
    // ------------------------------------------------------------------------
    const res3 = await httpRequest(
      'POST',
      '/api/v1/employees',
      {
        nome: 'Sub-operador',
        email: `subop.${Date.now()}@empresa.com.br`,
        lojaId: 'store-1-emp',
        status: 'ACTIVE'
      },
      operatorToken
    );

    const passou3 = res3.status === 403;
    results.push({
      num: 3,
      nome: 'Operador comum impedido de cadastrar funcionários (RBAC 403)',
      esperado: 'HTTP 403 Forbidden',
      obtido: `HTTP ${res3.status}`,
      passou: passou3
    });

    // ------------------------------------------------------------------------
    // TESTE 4: Bloqueio ao tentar vincular loja pertencente a outro tenant (Regra 6 & 7)
    // ------------------------------------------------------------------------
    const res4 = await httpRequest(
      'POST',
      '/api/v1/employees',
      {
        nome: 'Operador Loja Invasora',
        email: `invasor.${Date.now()}@empresa.com.br`,
        lojaId: 'store-other-tenant-99',
        status: 'ACTIVE'
      },
      adminToken
    );

    const passou4 = res4.status === 400 && res4.body?.erro?.includes('não existe ou não pertence');
    results.push({
      num: 4,
      nome: 'Isolamento de Tenant: Bloqueio de vinculação a loja de outro tenant',
      esperado: 'HTTP 400 com erro de validação de tenant/loja',
      obtido: `HTTP ${res4.status}: ${res4.body?.erro}`,
      passou: passou4
    });

    // ------------------------------------------------------------------------
    // TESTE 5: Desativação de funcionário pelo Administrador (Regra 5 e 10)
    // ------------------------------------------------------------------------
    const res5 = await httpRequest(
      'PATCH',
      `/api/v1/employees/${createdEmployeeId}/status`,
      { status: 'INACTIVE' },
      adminToken
    );

    const passou5 = res5.status === 200 && res5.body?.data?.active === false;
    results.push({
      num: 5,
      nome: 'Administrador desativa funcionário com registro em banco',
      esperado: 'HTTP 200 com active=false',
      obtido: `HTTP ${res5.status}, active: ${res5.body?.data?.active}`,
      passou: passou5
    });

    // ------------------------------------------------------------------------
    // TESTE 6: Reativação de funcionário pelo Administrador (Regra 5 e 10)
    // ------------------------------------------------------------------------
    const res6 = await httpRequest(
      'PATCH',
      `/api/v1/employees/${createdEmployeeId}/status`,
      { status: 'ACTIVE' },
      adminToken
    );

    const passou6 = res6.status === 200 && res6.body?.data?.active === true;
    results.push({
      num: 6,
      nome: 'Administrador reativa funcionário com registro em banco',
      esperado: 'HTTP 200 com active=true',
      obtido: `HTTP ${res6.status}, active: ${res6.body?.data?.active}`,
      passou: passou6
    });

    // ------------------------------------------------------------------------
    // TESTE 7: Operador impedido de alterar status de funcionários (Regra 8)
    // ------------------------------------------------------------------------
    const res7 = await httpRequest(
      'PATCH',
      `/api/v1/employees/${createdEmployeeId}/status`,
      { status: 'INACTIVE' },
      operatorToken
    );

    const passou7 = res7.status === 403;
    results.push({
      num: 7,
      nome: 'Operador impedido de alterar status de funcionários (RBAC 403)',
      esperado: 'HTTP 403 Forbidden',
      obtido: `HTTP ${res7.status}`,
      passou: passou7
    });

    // ------------------------------------------------------------------------
    // TESTE 8: Alteração de loja vinculada pelo Administrador (Regra 5 e 6)
    // ------------------------------------------------------------------------
    const res8 = await httpRequest(
      'PATCH',
      `/api/v1/employees/${createdEmployeeId}/store`,
      { lojaId: 'store-2-emp' },
      adminToken
    );

    const passou8 = res8.status === 200 && res8.body?.data?.lojaId === 'store-2-emp';
    results.push({
      num: 8,
      nome: 'Administrador altera loja vinculada do funcionário',
      esperado: 'HTTP 200 com lojaId=store-2-emp',
      obtido: `HTTP ${res8.status}, lojaId: ${res8.body?.data?.lojaId}`,
      passou: passou8
    });

    // ------------------------------------------------------------------------
    // TESTE 9: Consulta pública do convite via token (Regra 3)
    // ------------------------------------------------------------------------
    const res9 = await httpRequest('GET', `/api/v1/invitations/${invitationToken}`);
    const passou9 = res9.status === 200 && 
      res9.body?.data?.email === empEmail &&
      res9.body?.data?.role === 'OPERADOR' &&
      res9.body?.data?.storeNome !== undefined;

    results.push({
      num: 9,
      nome: 'Consulta segura dos dados do convite por token',
      esperado: 'HTTP 200 com dados públicos do convite (sem expor segredos)',
      obtido: `HTTP ${res9.status}, email: ${res9.body?.data?.email}, role: ${res9.body?.data?.role}`,
      passou: passou9
    });

    // ------------------------------------------------------------------------
    // TESTE 10: Aceite do convite e definição de PIN pelo próprio funcionário (Regra 3)
    // ------------------------------------------------------------------------
    const res10 = await httpRequest(
      'POST',
      `/api/v1/invitations/${invitationToken}/accept`,
      {
        pin: '4321',
        name: 'João da Silva Confirmado'
      }
    );

    const passou10 = res10.status === 200 && 
      res10.body?.data?.sucesso === true &&
      res10.body?.data?.role === 'OPERADOR';

    results.push({
      num: 10,
      nome: 'Funcionário aceita convite e configura PIN seguro',
      esperado: 'HTTP 200 com sucesso=true e role=OPERADOR',
      obtido: `HTTP ${res10.status}, sucesso: ${res10.body?.data?.sucesso}, role: ${res10.body?.data?.role}`,
      passou: passou10
    });

    // ------------------------------------------------------------------------
    // TESTE 11: Rejeição de reuso do convite aceito
    // ------------------------------------------------------------------------
    const res11 = await httpRequest(
      'POST',
      `/api/v1/invitations/${invitationToken}/accept`,
      { pin: '9999' }
    );

    const passou11 = res11.status === 400;
    results.push({
      num: 11,
      nome: 'Rejeição de reuso de token de convite já aceito',
      esperado: 'HTTP 400 Bad Request',
      obtido: `HTTP ${res11.status}: ${res11.body?.erro}`,
      passou: passou11
    });

    // ------------------------------------------------------------------------
    // TESTE 12: Auditoria das ações registradas no log (Regra 10)
    // ------------------------------------------------------------------------
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.tenantId, 'tenant-default'));
    const acoes = logs.map(l => l.action);
    const temCreate = acoes.includes('CRIACAO_FUNCIONARIO_OPERADOR');
    const temDeactivate = acoes.includes('DESATIVACAO_FUNCIONARIO_OPERADOR');
    const temActivate = acoes.includes('ATIVACAO_FUNCIONARIO_OPERADOR');
    const temUpdateStore = acoes.includes('VINCULACAO_LOJA_FUNCIONARIO');
    const temAccept = acoes.includes('ACEITE_CONVITE_FUNCIONARIO');

    const passou12 = temCreate && temDeactivate && temActivate && temUpdateStore && temAccept;
    results.push({
      num: 12,
      nome: 'Verificação dos registros de auditoria (criação, ativação, desativação, troca de loja, aceite)',
      esperado: 'Todos os eventos de auditoria registrados',
      obtido: `Create: ${temCreate}, Deactivate: ${temDeactivate}, Activate: ${temActivate}, Store: ${temUpdateStore}, Accept: ${temAccept}`,
      passou: passou12
    });

  } finally {
    server.close();
  }

  // Exibe resumo dos testes
  console.log('\n================================================================');
  console.log(' RESUMO DOS RESULTADOS DOS TESTES');
  console.log('================================================================');

  let falhas = 0;
  for (const r of results) {
    const icone = r.passou ? '✅ PASSOU' : '❌ FALHOU';
    console.log(`[${icone}] Teste ${r.num}: ${r.nome}`);
    console.log(`         Esperado: ${r.esperado}`);
    console.log(`         Obtido:   ${r.obtido}`);
    if (!r.passou) falhas++;
  }

  console.log('\n================================================================');
  if (falhas === 0) {
    console.log(`🎉 TODOS OS ${results.length} TESTES PASSARAM COM SUCESSO!`);
  } else {
    console.log(`⚠️ ${falhas} DE ${results.length} TESTES FALHARAM!`);
  }
  console.log('================================================================\n');

  if (falhas > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Erro fatal ao executar testes:', err);
  process.exit(1);
});
