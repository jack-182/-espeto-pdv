import crypto from 'crypto';
import { db } from './index.ts';
import { hashPinScrypt } from '../lib/security.ts';
import { 
  tenants, 
  stores, 
  terminals, 
  productCategories, 
  products, 
  storeInventories, 
  users, 
  cashSessions,
  cashMovements,
  auditLogs
} from './schema.ts';
import { eq, and } from 'drizzle-orm';

export const hashPin = (pin: string): string => {
  return hashPinScrypt(pin);
};

/**
 * Seed de dados fictícios/demonstração para ambientes locais de desenvolvimento e testes.
 * BLOQUEADO ESTRITAMENTE EM PRODUÇÃO (NODE_ENV=production):
 * Em produção, nenhum dado fictício (tenant, loja, produto, estoque, terminal, usuário demo) é inserido.
 */
export async function seedDevelopmentDemoDatabase() {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    console.log('[Seed] Modo de PRODUÇÃO ativo: Seed de dados demo/fictícios bloqueado. O banco corporativo não recebe dados fictícios.');
    return;
  }

  try {
    const existingTenants = await db.select().from(tenants);

    if (existingTenants.length === 0) {
      console.log('[Seed Dev/Demo] Inicializando dados demo de desenvolvimento no PostgreSQL...');

      // 1. Tenant Principal
      await db.insert(tenants).values({
        tenantId: 'tenant-default',
        name: 'Grupo Prime Gastronomia & Conveniência',
        slug: 'grupo-prime',
        cnpj: '45.123.789/0001-90',
        plan: 'ENTERPRISE',
        active: true
      });

      // 2. Stores (3 Unidades)
      await db.insert(stores).values([
        {
          storeId: 'emp-1',
          tenantId: 'tenant-default',
          tradeName: 'Espetinho 1',
          corporateName: 'Prime Grill Alimentos e Bebidas Ltda - Unidade 1',
          cnpj: '45.123.789/0001-90',
          segment: 'ESPETINHO',
          address: 'Rua das Palmeiras, 450 - Moema, São Paulo/SP',
          phone: '(11) 97766-5544',
          serviceTaxDefault: '0.00',
          comandaLimitBlock: '600.00',
          active: true
        },
        {
          storeId: 'emp-2',
          tenantId: 'tenant-default',
          tradeName: 'Espetinho 2',
          corporateName: 'Prime Grill Alimentos e Bebidas Ltda - Unidade 2',
          cnpj: '45.123.789/0002-71',
          segment: 'ESPETINHO',
          address: 'Av. Ibirapuera, 1850 - Indianópolis, São Paulo/SP',
          phone: '(11) 97766-5588',
          serviceTaxDefault: '0.00',
          comandaLimitBlock: '600.00',
          active: true
        },
        {
          storeId: 'emp-3',
          tenantId: 'tenant-default',
          tradeName: 'Tabacaria',
          corporateName: 'Imperial Tabacaria e Conveniência Ltda',
          cnpj: '34.892.110/0001-45',
          segment: 'TABACARIA',
          address: 'Av. Paulista, 1200 - Bela Vista, São Paulo/SP',
          phone: '(11) 98877-6655',
          serviceTaxDefault: '10.00',
          comandaLimitBlock: '450.00',
          active: true
        }
      ]);

      // 3. Terminais
      await db.insert(terminals).values([
        { terminalId: 'term-1', tenantId: 'tenant-default', storeId: 'emp-1', name: 'Caixa Balcão 1', code: 'CX-01', status: 'ACTIVE' },
        { terminalId: 'term-2', tenantId: 'tenant-default', storeId: 'emp-2', name: 'Caixa Balcão 2', code: 'CX-02', status: 'ACTIVE' },
        { terminalId: 'term-3', tenantId: 'tenant-default', storeId: 'emp-3', name: 'Caixa Tabacaria', code: 'CX-03', status: 'ACTIVE' }
      ]);

      // 4. Usuário Administrador Corporativo Inicial (Produção)
      // Em produção, nunca utiliza credenciais previsíveis: usa ADMIN_INITIAL_PIN ou gera PIN aleatório
      const isProduction = process.env.NODE_ENV === 'production';
      const initialAdminPin = process.env.ADMIN_INITIAL_PIN || (isProduction
        ? crypto.randomInt(100000, 999999).toString()
        : '849204');

      await db.insert(users).values([
        {
          uid: 'user-admin-jackson',
          tenantId: 'tenant-default',
          name: 'Jackson (Administrador)',
          email: 'jacksopereira.182@gmail.com',
          role: 'ADMINISTRADOR',
          pinHash: hashPin(initialAdminPin),
          active: true
        }
      ]);

      // 5. Categorias de Produtos
      await db.insert(productCategories).values([
        { categoryId: 'cat-espetos', tenantId: 'tenant-default', name: 'Espetos & Carnes', slug: 'espetos', color: '#ef4444', icon: 'Utensils' },
        { categoryId: 'cat-bebidas-alc', tenantId: 'tenant-default', name: 'Bebidas Alcoólicas & Chopp', slug: 'bebidas-alcoolicas', color: '#f59e0b', icon: 'Beer' },
        { categoryId: 'cat-bebidas-nao-alc', tenantId: 'tenant-default', name: 'Bebidas Não Alcoólicas', slug: 'bebidas-nao-alcoolicas', color: '#3b82f6', icon: 'Coffee' },
        { categoryId: 'cat-porcoes', tenantId: 'tenant-default', name: 'Porções & Acompanhamentos', slug: 'porcoes', color: '#10b981', icon: 'Bowl' },
        { categoryId: 'cat-narguile', tenantId: 'tenant-default', name: 'Essências & Narguile', slug: 'essencias-narguile', color: '#8b5cf6', icon: 'Wind' },
        { categoryId: 'cat-tabacaria-conv', tenantId: 'tenant-default', name: 'Carvão & Artigos Tabacaria', slug: 'carvao-aluminio', color: '#6b7280', icon: 'Package' }
      ]);

      // 6. Produtos
      await db.insert(products).values([
        {
          productId: 'prod-espeto-angus',
          tenantId: 'tenant-default',
          categoryId: 'cat-espetos',
          barcode: '78910001',
          sku: 'ESP-ANG-001',
          name: 'Espeto Carne Angus Premium',
          unit: 'UN',
          costPrice: '6.20',
          salePrice: '14.50',
          marginPercent: '57.24',
          stockMin: 20,
          stockMax: 200,
          isQuickSale: true,
          active: true
        },
        {
          productId: 'prod-espeto-queijo',
          tenantId: 'tenant-default',
          categoryId: 'cat-espetos',
          barcode: '78910002',
          sku: 'ESP-QJ-002',
          name: 'Espeto Queijo Coalho c/ Melado',
          unit: 'UN',
          costPrice: '4.80',
          salePrice: '12.00',
          marginPercent: '60.00',
          stockMin: 15,
          stockMax: 150,
          isQuickSale: true,
          active: true
        },
        {
          productId: 'prod-chopp-pilsen',
          tenantId: 'tenant-default',
          categoryId: 'cat-bebidas-alc',
          barcode: '78910003',
          sku: 'CHP-500-003',
          name: 'Chopp Pilsen Artesanal 500ml',
          unit: 'UN',
          costPrice: '5.50',
          salePrice: '15.00',
          marginPercent: '63.33',
          stockMin: 30,
          stockMax: 300,
          isQuickSale: true,
          active: true
        },
        {
          productId: 'prod-batata-rustica',
          tenantId: 'tenant-default',
          categoryId: 'cat-porcoes',
          barcode: '78910004',
          sku: 'POR-BAT-004',
          name: 'Batata Rústica com Alecrim',
          unit: 'UN',
          costPrice: '9.00',
          salePrice: '28.00',
          marginPercent: '67.86',
          stockMin: 10,
          stockMax: 80,
          isQuickSale: false,
          active: true
        },
        {
          productId: 'prod-sessao-nay',
          tenantId: 'tenant-default',
          categoryId: 'cat-narguile',
          barcode: '78920001',
          sku: 'NRG-NAY-001',
          name: 'Sessão Narguile Nay Love 66',
          unit: 'UN',
          costPrice: '16.00',
          salePrice: '45.00',
          marginPercent: '64.44',
          stockMin: 10,
          stockMax: 100,
          isQuickSale: true,
          active: true
        },
        {
          productId: 'prod-carvao-coco',
          tenantId: 'tenant-default',
          categoryId: 'cat-tabacaria-conv',
          barcode: '78920002',
          sku: 'CAR-COC-002',
          name: 'Carvão de Coco Hexagonal 1Kg',
          unit: 'UN',
          costPrice: '18.00',
          salePrice: '36.00',
          marginPercent: '50.00',
          stockMin: 10,
          stockMax: 100,
          isQuickSale: false,
          active: true
        },
        {
          productId: 'prod-redbull-250',
          tenantId: 'tenant-default',
          categoryId: 'cat-bebidas-nao-alc',
          barcode: '78920003',
          sku: 'BEB-RDB-003',
          name: 'Red Bull Energy Drink 250ml',
          unit: 'UN',
          costPrice: '8.50',
          salePrice: '16.00',
          marginPercent: '46.88',
          stockMin: 24,
          stockMax: 120,
          isQuickSale: true,
          active: true
        }
      ]);

      // 7. Inventários por Loja
      await db.insert(storeInventories).values([
        // Loja 1 (Espetinho 1)
        { tenantId: 'tenant-default', storeId: 'emp-1', productId: 'prod-espeto-angus', currentStock: 85, minStock: 20, maxStock: 200 },
        { tenantId: 'tenant-default', storeId: 'emp-1', productId: 'prod-espeto-queijo', currentStock: 42, minStock: 15, maxStock: 150 },
        { tenantId: 'tenant-default', storeId: 'emp-1', productId: 'prod-chopp-pilsen', currentStock: 120, minStock: 30, maxStock: 300 },
        { tenantId: 'tenant-default', storeId: 'emp-1', productId: 'prod-batata-rustica', currentStock: 30, minStock: 10, maxStock: 80 },

        // Loja 2 (Espetinho 2)
        { tenantId: 'tenant-default', storeId: 'emp-2', productId: 'prod-espeto-angus', currentStock: 60, minStock: 20, maxStock: 200, salePriceCustom: '15.00' },
        { tenantId: 'tenant-default', storeId: 'emp-2', productId: 'prod-espeto-queijo', currentStock: 28, minStock: 15, maxStock: 150, salePriceCustom: '13.00' },
        { tenantId: 'tenant-default', storeId: 'emp-2', productId: 'prod-chopp-pilsen', currentStock: 95, minStock: 30, maxStock: 300, salePriceCustom: '16.00' },

        // Loja 3 (Tabacaria)
        { tenantId: 'tenant-default', storeId: 'emp-3', productId: 'prod-sessao-nay', currentStock: 50, minStock: 10, maxStock: 100 },
        { tenantId: 'tenant-default', storeId: 'emp-3', productId: 'prod-carvao-coco', currentStock: 34, minStock: 10, maxStock: 100 },
        { tenantId: 'tenant-default', storeId: 'emp-3', productId: 'prod-redbull-250', currentStock: 78, minStock: 24, maxStock: 120 }
      ]);

      // 8. Turnos de Caixa Iniciais Abertos
      await db.insert(cashSessions).values([
        {
          sessionId: 'turno-emp-1',
          tenantId: 'tenant-default',
          storeId: 'emp-1',
          terminalId: 'term-1',
          sessionNumber: 104,
          operatorId: 'user-op-juliana',
          operatorName: 'Juliana Mendes',
          initialFund: '150.00',
          status: 'ABERTO',
          systemCash: '150.00',
          systemPix: '0.00',
          systemCard: '0.00'
        },
        {
          sessionId: 'turno-emp-2',
          tenantId: 'tenant-default',
          storeId: 'emp-2',
          terminalId: 'term-2',
          sessionNumber: 88,
          operatorId: 'user-op-carlos',
          operatorName: 'Carlos Silva',
          initialFund: '150.00',
          status: 'ABERTO',
          systemCash: '150.00',
          systemPix: '0.00',
          systemCard: '0.00'
        },
        {
          sessionId: 'turno-emp-3',
          tenantId: 'tenant-default',
          storeId: 'emp-3',
          terminalId: 'term-3',
          sessionNumber: 142,
          operatorId: 'user-op-ana',
          operatorName: 'Ana Souza',
          initialFund: '200.00',
          status: 'ABERTO',
          systemCash: '200.00',
          systemPix: '0.00',
          systemCard: '0.00'
        }
      ]);

      // 9. Movimentações Iniciais de Suprimento
      await db.insert(cashMovements).values([
        {
          movementId: 'mov-init-1',
          tenantId: 'tenant-default',
          storeId: 'emp-1',
          sessionId: 'turno-emp-1',
          type: 'SUPRIMENTO',
          amount: '150.00',
          paymentMethod: 'DINHEIRO',
          reason: 'Fundo de troco inicial do turno',
          operatorId: 'user-op-juliana',
          operatorName: 'Juliana Mendes'
        }
      ]);
    }

    console.log('[Seed Production] Dados base corporativos verificados.');
  } catch (error) {
    console.error('[Seed Error] Falha ao executar seed de produção no banco de dados:', error);
  }
}

/**
 * SEED DE HOMOLOGAÇÃO E TESTES
 * Provisiona usuários de teste com papéis específicos e fixtures para testes automatizados.
 * Executado estritamente fora de produção (NODE_ENV !== 'production').
 * Em produção, NUNCA executa, mesmo com ENABLE_TEST_AUTH='true'.
 */
export async function seedTestFixtures() {
  try {
    console.log('[Seed Test Fixtures] Inicializando fixtures isoladas de homologação/teste...');

    // 1. Operadores de Teste
    const testOperators = [
      {
        uid: 'user-op-juliana',
        tenantId: 'tenant-default',
        storeId: 'emp-1',
        name: 'Juliana Mendes',
        email: 'juliana.caixa@primegrill.com.br',
        role: 'OPERADOR' as const,
        pin: '571932',
        active: true
      },
      {
        uid: 'user-op-carlos',
        tenantId: 'tenant-default',
        storeId: 'emp-2',
        name: 'Carlos Silva',
        email: 'carlos.caixa@primegrill.com.br',
        role: 'OPERADOR' as const,
        pin: '619284',
        active: true
      },
      {
        uid: 'user-op-ana',
        tenantId: 'tenant-default',
        storeId: 'emp-3',
        name: 'Ana Souza',
        email: 'ana.caixa@imperialtabacaria.com.br',
        role: 'OPERADOR' as const,
        pin: '739150',
        active: true
      },
      {
        uid: 'user-gerente-paulo',
        tenantId: 'tenant-default',
        storeId: 'emp-1',
        name: 'Paulo Gerente',
        email: 'paulo.gerente@primegrill.com.br',
        role: 'GERENTE' as const,
        pin: '482910',
        active: true
      },
      {
        uid: 'user-inactive-marcos',
        tenantId: 'tenant-default',
        storeId: 'emp-1',
        name: 'Marcos Inativo',
        email: 'marcos.bloqueado@primegrill.com.br',
        role: 'OPERADOR' as const,
        pin: '999999',
        active: false
      },
      {
        uid: 'user-op-nostore',
        tenantId: 'tenant-default',
        storeId: undefined,
        name: 'Operador Sem Loja Vinculada',
        email: 'semloja.op@empresa.com.br',
        role: 'OPERADOR' as const,
        pin: '123456',
        active: true
      },
      {
        uid: 'user-caixa-lucas',
        tenantId: 'tenant-default',
        storeId: 'emp-1',
        name: 'Lucas Caixa',
        email: 'lucas.caixa@primegrill.com.br',
        role: 'CAIXA' as const,
        pin: '334455',
        active: true
      },
      {
        uid: 'user-fin-marcos',
        tenantId: 'tenant-default',
        storeId: 'emp-1',
        name: 'Marcos Financeiro',
        email: 'marcos.fin@primegrill.com.br',
        role: 'FINANCEIRO' as const,
        pin: '556677',
        active: true
      },
      {
        uid: 'user-est-roberto',
        tenantId: 'tenant-default',
        storeId: 'emp-1',
        name: 'Roberto Estoquista',
        email: 'roberto.est@primegrill.com.br',
        role: 'ESTOQUISTA' as const,
        pin: '778899',
        active: true
      },
      {
        uid: 'user-gerente-emp2',
        tenantId: 'tenant-default',
        storeId: 'emp-2',
        name: 'Gerente Loja 2',
        email: 'gerente.emp2@primegrill.com.br',
        role: 'GERENTE' as const,
        pin: '654321',
        active: true
      },
      {
        uid: 'user-superadmin-global',
        tenantId: 'tenant-default',
        name: 'Super Admin Master',
        email: 'superadmin@plataforma.com.br',
        role: 'SUPER_ADMIN' as const,
        pin: '998877',
        active: true
      }
    ];

    for (const op of testOperators) {
      const existing = await db.select().from(users).where(eq(users.uid, op.uid));
      if (existing.length === 0) {
        await db.insert(users).values({
          uid: op.uid,
          tenantId: op.tenantId,
          storeId: op.storeId,
          name: op.name,
          email: op.email,
          role: op.role,
          pinHash: hashPinScrypt(op.pin),
          active: op.active
        });
      } else if (existing[0].pinHash && !existing[0].pinHash.startsWith('scrypt:')) {
        await db.update(users)
          .set({ pinHash: hashPinScrypt(op.pin) })
          .where(eq(users.id, existing[0].id));
      }
    }

    // 2. Garante Tenant B para testes de isolamento multi-tenant
    const tenantBRows = await db.select().from(tenants).where(eq(tenants.tenantId, 'tenant-b-corp'));
    if (tenantBRows.length === 0) {
      await db.insert(tenants).values({
        tenantId: 'tenant-b-corp',
        name: 'Corporação B Isolada Ltda',
        slug: 'corp-b',
        cnpj: '99.888.777/0001-66',
        plan: 'STANDARD',
        active: true
      });

      await db.insert(stores).values({
        storeId: 'emp-b-1',
        tenantId: 'tenant-b-corp',
        tradeName: 'Loja B Unidade 1',
        corporateName: 'Corporação B Unidade 1',
        cnpj: '99.888.777/0001-66',
        segment: 'OUTROS',
        address: 'Av. Brasil, 500',
        phone: '(11) 9999-8888',
        serviceTaxDefault: '0.00',
        comandaLimitBlock: '500.00',
        active: true
      });

      await db.insert(products).values({
        productId: 'prod-b-1',
        tenantId: 'tenant-b-corp',
        categoryId: 'cat-espetos',
        barcode: '99990001',
        sku: 'CORP-B-001',
        name: 'Produto Exclusivo Tenant B',
        unit: 'UN',
        costPrice: '10.00',
        salePrice: '25.00',
        marginPercent: '60.00',
        stockMin: 5,
        stockMax: 50,
        isQuickSale: true,
        active: true
      });

      await db.insert(storeInventories).values({
        tenantId: 'tenant-b-corp',
        storeId: 'emp-b-1',
        productId: 'prod-b-1',
        currentStock: 100,
        minStock: 5,
        maxStock: 50
      });

      await db.insert(users).values({
        uid: 'user-tenant-b',
        tenantId: 'tenant-b-corp',
        storeId: 'emp-b-1',
        name: 'Operador Tenant B',
        email: 'operador@corpb.com.br',
        role: 'OPERADOR',
        pinHash: hashPinScrypt('123456'),
        active: true
      });
    } else {
      const userTB = await db.select().from(users).where(eq(users.uid, 'user-tenant-b'));
      if (userTB.length === 0) {
        await db.insert(users).values({
          uid: 'user-tenant-b',
          tenantId: 'tenant-b-corp',
          storeId: 'emp-b-1',
          name: 'Operador Tenant B',
          email: 'operador@corpb.com.br',
          role: 'OPERADOR',
          pinHash: hashPinScrypt('123456'),
          active: true
        });
      }
    }

    // 3. Garante produto inativo para testes de rejeição
    const prodInativoRows = await db.select().from(products).where(eq(products.productId, 'prod-inativo-teste'));
    if (prodInativoRows.length === 0) {
      await db.insert(products).values({
        productId: 'prod-inativo-teste',
        tenantId: 'tenant-default',
        categoryId: 'cat-espetos',
        barcode: '78919999',
        sku: 'INAT-001',
        name: 'Produto Inativo para Comercialização',
        unit: 'UN',
        costPrice: '5.00',
        salePrice: '10.00',
        marginPercent: '50.00',
        stockMin: 0,
        stockMax: 10,
        isQuickSale: false,
        active: false
      });
    }

    // 4. Garante produto com estoque = 1 para teste estrito de concorrência
    const prodConcRows = await db.select().from(products).where(eq(products.productId, 'prod-concorrencia-estoque'));
    if (prodConcRows.length === 0) {
      await db.insert(products).values({
        productId: 'prod-concorrencia-estoque',
        tenantId: 'tenant-default',
        categoryId: 'cat-espetos',
        barcode: '78918888',
        sku: 'CONC-001',
        name: 'Produto Teste Concorrência de Estoque',
        unit: 'UN',
        costPrice: '5.00',
        salePrice: '20.00',
        marginPercent: '75.00',
        stockMin: 0,
        stockMax: 10,
        isQuickSale: true,
        active: true
      });
    }

    // Garante que o inventário de emp-1 para prod-concorrencia-estoque tenha exatamente estoque 1
    const invConcRows = await db.select().from(storeInventories)
      .where(eq(storeInventories.productId, 'prod-concorrencia-estoque'));
    if (invConcRows.length === 0) {
      await db.insert(storeInventories).values({
        tenantId: 'tenant-default',
        storeId: 'emp-1',
        productId: 'prod-concorrencia-estoque',
        currentStock: 1,
        minStock: 0,
        maxStock: 10
      });
    }

    // 5. Garante produto para teste de rollback de transação atômica
    const prodRollbackRows = await db.select().from(products).where(eq(products.productId, 'prod-rollback-teste'));
    if (prodRollbackRows.length === 0) {
      await db.insert(products).values({
        productId: 'prod-rollback-teste',
        tenantId: 'tenant-default',
        categoryId: 'cat-espetos',
        barcode: '78917777',
        sku: 'ROLL-001',
        name: 'Produto Teste Rollback Atômico',
        unit: 'UN',
        costPrice: '5.00',
        salePrice: '15.00',
        marginPercent: '66.67',
        stockMin: 0,
        stockMax: 50,
        isQuickSale: true,
        active: true
      });
    }

    const invRollbackRows = await db.select().from(storeInventories)
      .where(eq(storeInventories.productId, 'prod-rollback-teste'));
    if (invRollbackRows.length === 0) {
      await db.insert(storeInventories).values({
        tenantId: 'tenant-default',
        storeId: 'emp-1',
        productId: 'prod-rollback-teste',
        currentStock: 10,
        minStock: 0,
        maxStock: 50
      });
    }

    console.log('[Seed Test Fixtures] Fixtures isoladas de teste preparadas com sucesso.');
  } catch (error) {
    console.error('[Seed Error] Falha ao preparar fixtures de teste:', error);
  }
}

/**
 * Mantido por compatibilidade: Em produção, NUNCA executa dados fictícios/demo.
 * O banco de produção inicia vazio caso ainda não tenha dados.
 */
export async function seedProductionDatabase() {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    console.log('[Seed] Modo de PRODUÇÃO ativo: seedProductionDatabase bloqueado. Nenhum dado fictício ou demo inserido.');
    return;
  }
  return seedDevelopmentDemoDatabase();
}

/**
 * Função principal de inicialização do banco.
 * 
 * Regras estritas:
 * 1. Em produção (NODE_ENV=production):
 *    - NÃO executa nenhum seed de dados fictícios/demo.
 *    - O banco de produção inicia vazio caso ainda não tenha dados.
 *    - Nenhum tenant, loja, produto, estoque, terminal ou usuário fictício é criado automaticamente.
 * 2. Fora de produção (desenvolvimento e testes):
 *    - Executa o seed de dados demo de desenvolvimento e fixtures de teste normalmente.
 */
export async function seedDatabase() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    console.log('[Seed] Modo de PRODUÇÃO detectado (NODE_ENV=production):');
    console.log('[Seed] Regra estrita de segurança: Nenhum seed automático de dados fictícios/demo será executado.');
    console.log('[Seed] O banco de produção inicia vazio se ainda não possuir dados corporativos.');
    return;
  }

  // Ambientes locais de desenvolvimento e testes automatizados:
  await seedDevelopmentDemoDatabase();
  await seedTestFixtures();
}

export interface BootstrapAdminParams {
  tenantId?: string;
  tenantName?: string;
  tenantCnpj?: string;
  name: string;
  email: string;
  pin: string;
  uid?: string;
}

/**
 * Fluxo EXPLÍCITO e SEGURO de inicialização do primeiro administrador corporativo em produção.
 * 
 * Regras de Segurança:
 * 1. NUNCA executado automaticamente por seed, startup ou timer.
 * 2. Exige chamada explícita (via CLI `scripts/bootstrap_admin.ts` ou comando administrativo).
 * 3. Validação Fail-Closed:
 *    - Se já existir qualquer administrador ativo no tenant, a operação é abortada para evitar sequestro de conta.
 *    - Validação de formato de e-mail e tamanho seguro de PIN (mínimo 6 dígitos numéricos).
 * 4. O PIN é criptografado com hash seguro scrypt com salt único criptográfico.
 * 5. Registra log de auditoria formal da inicialização do primeiro administrador.
 */
export async function bootstrapInitialAdmin(params: BootstrapAdminParams) {
  const {
    tenantId = 'tenant-corp',
    tenantName = 'Organização Corporativa',
    tenantCnpj = '00.000.000/0001-00',
    name,
    email,
    pin,
    uid
  } = params;

  if (!email || !email.includes('@')) {
    throw new Error('[Bootstrap] E-mail inválido para o primeiro administrador.');
  }

  if (!name || name.trim().length < 2) {
    throw new Error('[Bootstrap] Nome obrigatório para o primeiro administrador.');
  }

  if (!pin || !/^\d{6,}$/.test(pin)) {
    throw new Error('[Bootstrap] PIN inseguro: o PIN do administrador deve conter no mínimo 6 dígitos numéricos.');
  }

  // 1. Verifica se já existe algum administrador ativo no tenant
  const existingAdmins = await db.select().from(users).where(
    and(
      eq(users.tenantId, tenantId),
      eq(users.role, 'ADMINISTRADOR'),
      eq(users.active, true)
    )
  );

  if (existingAdmins.length > 0) {
    throw new Error(`[Bootstrap] Bloqueado: Já existe ${existingAdmins.length} administrador(es) ativo(s) cadastrado(s) para o tenant '${tenantId}'.`);
  }

  const existingByEmail = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));
  if (existingByEmail.length > 0) {
    throw new Error(`[Bootstrap] Bloqueado: Já existe usuário cadastrado com o e-mail '${email}'.`);
  }

  // 2. Garante existência do tenant de forma explícita
  const tenantRows = await db.select().from(tenants).where(eq(tenants.tenantId, tenantId));
  if (tenantRows.length === 0) {
    await db.insert(tenants).values({
      tenantId,
      name: tenantName,
      slug: tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      cnpj: tenantCnpj,
      plan: 'ENTERPRISE',
      active: true
    });
    console.log(`[Bootstrap] Tenant '${tenantId}' criado com sucesso.`);
  }

  // 3. Cria o primeiro administrador corporativo
  const adminUid = uid || `admin-${crypto.randomUUID()}`;
  const pinHashed = hashPinScrypt(pin);

  await db.insert(users).values({
    uid: adminUid,
    tenantId,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role: 'ADMINISTRADOR',
    pinHash: pinHashed,
    active: true
  });

  // 4. Auditoria formal
  await db.insert(auditLogs).values({
    tenantId,
    userId: adminUid,
    userName: name.trim(),
    action: 'BOOTSTRAP_PRIMEIRO_ADMINISTRADOR',
    entity: 'users',
    entityId: adminUid,
    newValues: { email: email.trim().toLowerCase(), role: 'ADMINISTRADOR' },
    ipAddress: 'bootstrap-cli'
  }).catch(() => {});

  console.log(`[Bootstrap] Primeiro administrador criado com sucesso para o tenant '${tenantId}': ${email} (${adminUid})`);
  return {
    sucesso: true,
    tenantId,
    uid: adminUid,
    email: email.trim().toLowerCase()
  };
}
