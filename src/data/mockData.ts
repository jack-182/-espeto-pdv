/**
 * ============================================================================
 * AVISO IMPORTANTE: MÓDULO EXCLUSIVO DE TIPAGENS / TESTES UNITÁRIOS LEGADOS
 * 
 * PROIBIDO O USO COMO DADOS OPERACIONAIS OU FALLBACK EM PRODUÇÃO.
 * Toda a operação em produção é sincronizada em tempo real com o PostgreSQL.
 * ============================================================================
 */
import { Empresa, Operador, Produto, Comanda, TurnoCaixa, MovimentacaoCaixa } from '../types';

export const empresasIniciais: Empresa[] = [
  {
    id: 'emp-1',
    nomeFantasia: 'Espetinho 1',
    razaoSocial: 'Prime Grill Alimentos e Bebidas Ltda - Unidade 1',
    cnpj: '45.123.789/0001-90',
    segmento: 'ESPETINHO',
    endereco: 'Rua das Palmeiras, 450 - Moema, São Paulo/SP',
    telefone: '(11) 97766-5544',
    taxaServicoPadrao: 0,
    bloqueioLimiteComanda: 600.00
  },
  {
    id: 'emp-2',
    nomeFantasia: 'Espetinho 2',
    razaoSocial: 'Prime Grill Alimentos e Bebidas Ltda - Unidade 2',
    cnpj: '45.123.789/0002-71',
    segmento: 'ESPETINHO',
    endereco: 'Av. Ibirapuera, 1850 - Indianópolis, São Paulo/SP',
    telefone: '(11) 97766-5588',
    taxaServicoPadrao: 0,
    bloqueioLimiteComanda: 600.00
  },
  {
    id: 'emp-3',
    nomeFantasia: 'Tabacaria',
    razaoSocial: 'Imperial Tabacaria e Conveniência Ltda',
    cnpj: '34.892.110/0001-45',
    segmento: 'TABACARIA',
    endereco: 'Av. Paulista, 1200 - Bela Vista, São Paulo/SP',
    telefone: '(11) 98877-6655',
    taxaServicoPadrao: 10,
    bloqueioLimiteComanda: 450.00
  }
];

export const operadoresIniciais: Operador[] = [
  {
    id: 'op-admin',
    nome: 'Jackson (Administrador)',
    cargo: 'Administrador do Sistema',
    role: 'ADMINISTRADOR'
  },
  {
    id: 'op-2',
    nome: 'Juliana Mendes',
    cargo: 'Operadora de Caixa',
    role: 'OPERADOR'
  },
  {
    id: 'op-1',
    nome: 'Carlos Eduardo',
    cargo: 'Operador de Caixa',
    role: 'OPERADOR'
  },
  {
    id: 'op-3',
    nome: 'Matheus Ribeiro',
    cargo: 'Operador de Caixa',
    role: 'OPERADOR'
  }
];

// ==================== PRODUTOS POR LOJA ====================

export const produtosEspetinho1: Produto[] = [
  {
    id: 'e1-prod-1',
    nome: 'Espeto de Carne Bovina Angus',
    categoria: 'ESPETOS',
    precoVenda: 14.00,
    precoCusto: 6.50,
    estoqueAtual: 85,
    estoqueMinimo: 20,
    unidade: 'UN',
    atalhoRapido: true
  },
  {
    id: 'e1-prod-2',
    nome: 'Espeto de Queijo Coalho c/ Melado',
    categoria: 'ESPETOS',
    precoVenda: 13.00,
    precoCusto: 5.20,
    estoqueAtual: 42,
    estoqueMinimo: 15,
    unidade: 'UN',
    atalhoRapido: true
  },
  {
    id: 'e1-prod-3',
    nome: 'Espeto de Frango c/ Bacon (Medalhão)',
    categoria: 'ESPETOS',
    precoVenda: 13.50,
    precoCusto: 5.80,
    estoqueAtual: 60,
    estoqueMinimo: 15,
    unidade: 'UN',
    atalhoRapido: true
  },
  {
    id: 'e1-prod-4',
    nome: 'Espeto de Pão de Alho Especial',
    categoria: 'ESPETOS',
    precoVenda: 9.00,
    precoCusto: 3.20,
    estoqueAtual: 50,
    estoqueMinimo: 10,
    unidade: 'UN',
    atalhoRapido: true
  },
  {
    id: 'e1-prod-5',
    nome: 'Espeto de Coração de Frango',
    categoria: 'ESPETOS',
    precoVenda: 13.00,
    precoCusto: 5.00,
    estoqueAtual: 35,
    estoqueMinimo: 10,
    unidade: 'UN',
    atalhoRapido: true
  },
  {
    id: 'e1-prod-6',
    nome: 'Porção Batata Frita Rústica c/ Cheddar e Bacon',
    categoria: 'PORCOES',
    precoVenda: 38.00,
    precoCusto: 14.00,
    estoqueAtual: 30,
    estoqueMinimo: 8,
    unidade: 'UN'
  },
  {
    id: 'e1-prod-7',
    nome: 'Chopp Artesanal Pilsen 500ml',
    categoria: 'BEBIDAS_ALCOOLICAS',
    precoVenda: 16.00,
    precoCusto: 6.00,
    estoqueAtual: 140,
    estoqueMinimo: 30,
    unidade: 'UN',
    atalhoRapido: true
  },
  {
    id: 'e1-prod-8',
    nome: 'Cerveja Heineken Long Neck 330ml',
    categoria: 'BEBIDAS_ALCOOLICAS',
    precoVenda: 13.00,
    precoCusto: 6.80,
    estoqueAtual: 96,
    estoqueMinimo: 24,
    unidade: 'UN',
    atalhoRapido: true
  },
  {
    id: 'e1-prod-9',
    nome: 'Refrigerante Lata 350ml (Coca-Cola / Guaraná)',
    categoria: 'BEBIDAS_NAO_ALCOOLICAS',
    precoVenda: 7.00,
    precoCusto: 3.10,
    estoqueAtual: 120,
    estoqueMinimo: 30,
    unidade: 'UN',
    atalhoRapido: true
  },
  {
    id: 'e1-prod-10',
    nome: 'Água Mineral c/ ou s/ Gás 500ml',
    categoria: 'BEBIDAS_NAO_ALCOOLICAS',
    precoVenda: 5.00,
    precoCusto: 1.50,
    estoqueAtual: 150,
    estoqueMinimo: 40,
    unidade: 'UN',
    atalhoRapido: true
  },
  {
    id: 'e1-prod-11',
    nome: 'Energético Red Bull 250ml',
    categoria: 'BEBIDAS_NAO_ALCOOLICAS',
    precoVenda: 16.00,
    precoCusto: 8.50,
    estoqueAtual: 75,
    estoqueMinimo: 20,
    unidade: 'UN',
    atalhoRapido: true
  }
];

export const produtosEspetinho2: Produto[] = [
  {
    id: 'e2-prod-1',
    nome: 'Espeto de Picanha Bovina Nobre',
    categoria: 'ESPETOS',
    precoVenda: 18.00,
    precoCusto: 8.50,
    estoqueAtual: 70,
    estoqueMinimo: 15,
    unidade: 'UN',
    atalhoRapido: true
  },
  {
    id: 'e2-prod-2',
    nome: 'Espeto de Carne Angus',
    categoria: 'ESPETOS',
    precoVenda: 14.00,
    precoCusto: 6.50,
    estoqueAtual: 90,
    estoqueMinimo: 20,
    unidade: 'UN',
    atalhoRapido: true
  },
  {
    id: 'e2-prod-3',
    nome: 'Espeto Kafta Recheada c/ Queijo',
    categoria: 'ESPETOS',
    precoVenda: 15.00,
    precoCusto: 6.20,
    estoqueAtual: 45,
    estoqueMinimo: 12,
    unidade: 'UN',
    atalhoRapido: true
  },
  {
    id: 'e2-prod-4',
    nome: 'Espeto de Pão de Alho Especial',
    categoria: 'ESPETOS',
    precoVenda: 9.00,
    precoCusto: 3.20,
    estoqueAtual: 55,
    estoqueMinimo: 10,
    unidade: 'UN',
    atalhoRapido: true
  },
  {
    id: 'e2-prod-5',
    nome: 'Porção Mandioca Frita c/ Bacon Crocante',
    categoria: 'PORCOES',
    precoVenda: 34.00,
    precoCusto: 12.00,
    estoqueAtual: 28,
    estoqueMinimo: 8,
    unidade: 'UN'
  },
  {
    id: 'e2-prod-6',
    nome: 'Combo Espetos Família (8 Espetos Variados + Batata)',
    categoria: 'COMBOS',
    precoVenda: 89.00,
    precoCusto: 38.00,
    estoqueAtual: 20,
    estoqueMinimo: 5,
    unidade: 'UN',
    atalhoRapido: true
  },
  {
    id: 'e2-prod-7',
    nome: 'Chopp Brahma 500ml',
    categoria: 'BEBIDAS_ALCOOLICAS',
    precoVenda: 15.00,
    precoCusto: 5.50,
    estoqueAtual: 180,
    estoqueMinimo: 40,
    unidade: 'UN',
    atalhoRapido: true
  },
  {
    id: 'e2-prod-8',
    nome: 'Cerveja Amstel 600ml',
    categoria: 'BEBIDAS_ALCOOLICAS',
    precoVenda: 14.00,
    precoCusto: 6.20,
    estoqueAtual: 80,
    estoqueMinimo: 20,
    unidade: 'UN',
    atalhoRapido: true
  },
  {
    id: 'e2-prod-9',
    nome: 'Refrigerante Lata 350ml',
    categoria: 'BEBIDAS_NAO_ALCOOLICAS',
    precoVenda: 7.00,
    precoCusto: 3.10,
    estoqueAtual: 110,
    estoqueMinimo: 25,
    unidade: 'UN',
    atalhoRapido: true
  },
  {
    id: 'e2-prod-10',
    nome: 'Água Mineral 500ml',
    categoria: 'BEBIDAS_NAO_ALCOOLICAS',
    precoVenda: 5.00,
    precoCusto: 1.50,
    estoqueAtual: 130,
    estoqueMinimo: 30,
    unidade: 'UN',
    atalhoRapido: true
  }
];

export const produtosTabacaria: Produto[] = [
  {
    id: 'tab-prod-1',
    nome: 'Sessão Narguile Completa (Nay / Love 66 / Ziggy)',
    categoria: 'ESSENCIAS_NARGHILE',
    precoVenda: 35.00,
    precoCusto: 11.00,
    estoqueAtual: 90,
    estoqueMinimo: 15,
    unidade: 'UN',
    atalhoRapido: true
  },
  {
    id: 'tab-prod-2',
    nome: 'Essência Zomo Strong Mint 50g',
    categoria: 'ESSENCIAS_NARGHILE',
    precoVenda: 15.00,
    precoCusto: 7.50,
    estoqueAtual: 45,
    estoqueMinimo: 10,
    unidade: 'UN',
    atalhoRapido: true
  },
  {
    id: 'tab-prod-3',
    nome: 'Essência Ziggy Tropical 50g',
    categoria: 'ESSENCIAS_NARGHILE',
    precoVenda: 16.00,
    precoCusto: 8.00,
    estoqueAtual: 38,
    estoqueMinimo: 10,
    unidade: 'UN',
    atalhoRapido: true
  },
  {
    id: 'tab-prod-4',
    nome: 'Carvão de Coco Hexagonal 1kg (ArtCoco)',
    categoria: 'CARVAO_ALUMINIO',
    precoVenda: 38.00,
    precoCusto: 19.00,
    estoqueAtual: 22,
    estoqueMinimo: 6,
    unidade: 'PACOTE',
    atalhoRapido: true
  },
  {
    id: 'tab-prod-5',
    nome: 'Fita Alumínio Predador 50 Folhas',
    categoria: 'CARVAO_ALUMINIO',
    precoVenda: 18.00,
    precoCusto: 8.50,
    estoqueAtual: 35,
    estoqueMinimo: 8,
    unidade: 'UN'
  },
  {
    id: 'tab-prod-6',
    nome: 'Pod Descartável Ignite V50 5000 Puffs',
    categoria: 'PODS_VAPES',
    precoVenda: 110.00,
    precoCusto: 52.00,
    estoqueAtual: 28,
    estoqueMinimo: 5,
    unidade: 'UN',
    atalhoRapido: true
  },
  {
    id: 'tab-prod-7',
    nome: 'Seda Raw Classic King Size',
    categoria: 'CIGARROS_FUMOS',
    precoVenda: 9.00,
    precoCusto: 4.20,
    estoqueAtual: 64,
    estoqueMinimo: 15,
    unidade: 'UN',
    atalhoRapido: true
  },
  {
    id: 'tab-prod-8',
    nome: 'Combo Gin Tropical (Bombay + Red Bull Tropical + Especiarias)',
    categoria: 'COMBOS',
    precoVenda: 189.00,
    precoCusto: 85.00,
    estoqueAtual: 18,
    estoqueMinimo: 5,
    unidade: 'UN',
    atalhoRapido: true
  },
  {
    id: 'tab-prod-9',
    nome: 'Energético Red Bull 250ml',
    categoria: 'BEBIDAS_NAO_ALCOOLICAS',
    precoVenda: 16.00,
    precoCusto: 8.50,
    estoqueAtual: 85,
    estoqueMinimo: 20,
    unidade: 'UN',
    atalhoRapido: true
  },
  {
    id: 'tab-prod-10',
    nome: 'Chopp Artesanal 500ml',
    categoria: 'BEBIDAS_ALCOOLICAS',
    precoVenda: 16.00,
    precoCusto: 6.00,
    estoqueAtual: 100,
    estoqueMinimo: 20,
    unidade: 'UN',
    atalhoRapido: true
  },
  {
    id: 'tab-prod-11',
    nome: 'Água Mineral 500ml',
    categoria: 'BEBIDAS_NAO_ALCOOLICAS',
    precoVenda: 5.00,
    precoCusto: 1.50,
    estoqueAtual: 120,
    estoqueMinimo: 25,
    unidade: 'UN'
  }
];

export const produtosPorEmpresa: Record<string, Produto[]> = {
  'emp-1': produtosEspetinho1,
  'emp-2': produtosEspetinho2,
  'emp-3': produtosTabacaria
};

export const produtosIniciais = produtosEspetinho1;

// ==================== COMANDAS POR LOJA ====================

export const comandasEspetinho1: Comanda[] = [
  {
    id: 'cmd-e1-01',
    numero: 1,
    tipo: 'MESA',
    clienteNome: 'Mesa da Varanda 01',
    status: 'ABERTA',
    abertaEm: '2026-09-01T18:15:00',
    abertaPor: 'Juliana Mendes',
    itens: [
      {
        id: 'it-e1-1',
        produtoId: 'e1-prod-7',
        nomeProduto: 'Chopp Artesanal Pilsen 500ml',
        quantidade: 3,
        precoUnitario: 16.00,
        subtotal: 48.00,
        adicionadoEm: '2026-09-01T18:20:00',
        adicionadoPor: 'Juliana Mendes'
      },
      {
        id: 'it-e1-2',
        produtoId: 'e1-prod-1',
        nomeProduto: 'Espeto de Carne Bovina Angus',
        quantidade: 2,
        precoUnitario: 14.00,
        subtotal: 28.00,
        adicionadoEm: '2026-09-01T18:22:00',
        adicionadoPor: 'Juliana Mendes'
      }
    ],
    totalBruto: 76.00,
    desconto: 0,
    taxaServico: 0,
    totalLiquido: 76.00,
    pago: false
  },
  {
    id: 'cmd-e1-07',
    numero: 7,
    tipo: 'MESA',
    clienteNome: 'Mesa 07 - Rafael',
    status: 'EM_FECHAMENTO',
    abertaEm: '2026-09-01T19:10:00',
    abertaPor: 'Juliana Mendes',
    itens: [
      {
        id: 'it-e1-3',
        produtoId: 'e1-prod-2',
        nomeProduto: 'Espeto de Queijo Coalho c/ Melado',
        quantidade: 2,
        precoUnitario: 13.00,
        subtotal: 26.00,
        adicionadoEm: '2026-09-01T19:12:00',
        adicionadoPor: 'Juliana Mendes'
      },
      {
        id: 'it-e1-4',
        produtoId: 'e1-prod-8',
        nomeProduto: 'Cerveja Heineken Long Neck 330ml',
        quantidade: 4,
        precoUnitario: 13.00,
        subtotal: 52.00,
        adicionadoEm: '2026-09-01T19:15:00',
        adicionadoPor: 'Juliana Mendes'
      }
    ],
    totalBruto: 78.00,
    desconto: 0,
    taxaServico: 0,
    totalLiquido: 78.00,
    pago: false
  },
  {
    id: 'cmd-e1-12',
    numero: 12,
    tipo: 'BALCAO_RAPIDO',
    clienteNome: 'Balcão Rápido',
    status: 'PAGA',
    abertaEm: '2026-09-01T17:30:00',
    fechadaEm: '2026-09-01T17:35:00',
    abertaPor: 'Juliana Mendes',
    itens: [
      {
        id: 'it-e1-5',
        produtoId: 'e1-prod-11',
        nomeProduto: 'Energético Red Bull 250ml',
        quantidade: 2,
        precoUnitario: 16.00,
        subtotal: 32.00,
        adicionadoEm: '2026-09-01T17:30:00',
        adicionadoPor: 'Juliana Mendes'
      }
    ],
    totalBruto: 32.00,
    desconto: 0,
    taxaServico: 0,
    totalLiquido: 32.00,
    pago: true
  }
];

export const comandasEspetinho2: Comanda[] = [
  {
    id: 'cmd-e2-02',
    numero: 2,
    tipo: 'MESA',
    clienteNome: 'Mesa Central 02 - Lucas',
    status: 'ABERTA',
    abertaEm: '2026-09-01T18:00:00',
    abertaPor: 'Carlos Eduardo',
    itens: [
      {
        id: 'it-e2-1',
        produtoId: 'e2-prod-7',
        nomeProduto: 'Chopp Brahma 500ml',
        quantidade: 4,
        precoUnitario: 15.00,
        subtotal: 60.00,
        adicionadoEm: '2026-09-01T18:05:00',
        adicionadoPor: 'Carlos Eduardo'
      },
      {
        id: 'it-e2-2',
        produtoId: 'e2-prod-1',
        nomeProduto: 'Espeto de Picanha Bovina Nobre',
        quantidade: 3,
        precoUnitario: 18.00,
        subtotal: 54.00,
        adicionadoEm: '2026-09-01T18:10:00',
        adicionadoPor: 'Carlos Eduardo'
      },
      {
        id: 'it-e2-3',
        produtoId: 'e2-prod-4',
        nomeProduto: 'Espeto de Pão de Alho Especial',
        quantidade: 2,
        precoUnitario: 9.00,
        subtotal: 18.00,
        adicionadoEm: '2026-09-01T18:12:00',
        adicionadoPor: 'Carlos Eduardo'
      }
    ],
    totalBruto: 132.00,
    desconto: 0,
    taxaServico: 0,
    totalLiquido: 132.00,
    pago: false
  },
  {
    id: 'cmd-e2-05',
    numero: 5,
    tipo: 'MESA',
    clienteNome: 'Mesa Família Oliveira',
    status: 'ABERTA',
    abertaEm: '2026-09-01T18:30:00',
    abertaPor: 'Carlos Eduardo',
    itens: [
      {
        id: 'it-e2-4',
        produtoId: 'e2-prod-6',
        nomeProduto: 'Combo Espetos Família (8 Espetos + Batata)',
        quantidade: 1,
        precoUnitario: 89.00,
        subtotal: 89.00,
        adicionadoEm: '2026-09-01T18:35:00',
        adicionadoPor: 'Carlos Eduardo'
      },
      {
        id: 'it-e2-5',
        produtoId: 'e2-prod-7',
        nomeProduto: 'Chopp Brahma 500ml',
        quantidade: 4,
        precoUnitario: 15.00,
        subtotal: 60.00,
        adicionadoEm: '2026-09-01T18:40:00',
        adicionadoPor: 'Carlos Eduardo'
      }
    ],
    totalBruto: 149.00,
    desconto: 0,
    taxaServico: 0,
    totalLiquido: 149.00,
    pago: false
  },
  {
    id: 'cmd-e2-03',
    numero: 3,
    tipo: 'BALCAO_RAPIDO',
    clienteNome: 'Balcão Rápido Espeto 2',
    status: 'PAGA',
    abertaEm: '2026-09-01T17:15:00',
    fechadaEm: '2026-09-01T17:25:00',
    abertaPor: 'Carlos Eduardo',
    itens: [
      {
        id: 'it-e2-6',
        produtoId: 'e2-prod-2',
        nomeProduto: 'Espeto de Carne Angus',
        quantidade: 3,
        precoUnitario: 14.00,
        subtotal: 42.00,
        adicionadoEm: '2026-09-01T17:15:00',
        adicionadoPor: 'Carlos Eduardo'
      }
    ],
    totalBruto: 42.00,
    desconto: 0,
    taxaServico: 0,
    totalLiquido: 42.00,
    pago: true
  }
];

export const comandasTabacaria: Comanda[] = [
  {
    id: 'cmd-tab-01',
    numero: 1,
    tipo: 'COMANDA_CARTAO',
    clienteNome: 'Lounge VIP - Grupo André',
    status: 'ABERTA',
    abertaEm: '2026-09-01T18:30:00',
    abertaPor: 'Matheus Ribeiro',
    itens: [
      {
        id: 'it-tab-1',
        produtoId: 'tab-prod-1',
        nomeProduto: 'Sessão Narguile Completa (Nay / Love 66)',
        quantidade: 1,
        precoUnitario: 35.00,
        subtotal: 35.00,
        adicionadoEm: '2026-09-01T18:32:00',
        adicionadoPor: 'Matheus Ribeiro'
      },
      {
        id: 'it-tab-2',
        produtoId: 'tab-prod-8',
        nomeProduto: 'Combo Gin Tropical (Bombay + Red Bull Tropical)',
        quantidade: 1,
        precoUnitario: 189.00,
        subtotal: 189.00,
        adicionadoEm: '2026-09-01T18:40:00',
        adicionadoPor: 'Matheus Ribeiro'
      }
    ],
    totalBruto: 224.00,
    desconto: 0,
    taxaServico: 22.40, // 10%
    totalLiquido: 246.40,
    pago: false
  },
  {
    id: 'cmd-tab-04',
    numero: 4,
    tipo: 'COMANDA_CARTAO',
    clienteNome: 'Lounge 04 - Lucas & Amigos',
    status: 'ABERTA',
    abertaEm: '2026-09-01T18:45:00',
    abertaPor: 'Matheus Ribeiro',
    itens: [
      {
        id: 'it-tab-3',
        produtoId: 'tab-prod-1',
        nomeProduto: 'Sessão Narguile Completa',
        quantidade: 1,
        precoUnitario: 35.00,
        subtotal: 35.00,
        adicionadoEm: '2026-09-01T18:50:00',
        adicionadoPor: 'Matheus Ribeiro'
      },
      {
        id: 'it-tab-4',
        produtoId: 'tab-prod-6',
        nomeProduto: 'Pod Descartável Ignite V50 5000 Puffs',
        quantidade: 1,
        precoUnitario: 110.00,
        subtotal: 110.00,
        adicionadoEm: '2026-09-01T19:05:00',
        adicionadoPor: 'Matheus Ribeiro'
      }
    ],
    totalBruto: 145.00,
    desconto: 0,
    taxaServico: 14.50, // 10%
    totalLiquido: 159.50,
    pago: false
  },
  {
    id: 'cmd-tab-08',
    numero: 8,
    tipo: 'BALCAO_RAPIDO',
    clienteNome: 'Balcão Tabacaria',
    status: 'PAGA',
    abertaEm: '2026-09-01T17:40:00',
    fechadaEm: '2026-09-01T17:48:00',
    abertaPor: 'Matheus Ribeiro',
    itens: [
      {
        id: 'it-tab-5',
        produtoId: 'tab-prod-4',
        nomeProduto: 'Carvão de Coco Hexagonal 1kg',
        quantidade: 1,
        precoUnitario: 38.00,
        subtotal: 38.00,
        adicionadoEm: '2026-09-01T17:40:00',
        adicionadoPor: 'Matheus Ribeiro'
      },
      {
        id: 'it-tab-6',
        produtoId: 'tab-prod-2',
        nomeProduto: 'Essência Zomo Strong Mint 50g',
        quantidade: 1,
        precoUnitario: 15.00,
        subtotal: 15.00,
        adicionadoEm: '2026-09-01T17:42:00',
        adicionadoPor: 'Matheus Ribeiro'
      },
      {
        id: 'it-tab-7',
        produtoId: 'tab-prod-7',
        nomeProduto: 'Seda Raw Classic King Size',
        quantidade: 1,
        precoUnitario: 9.00,
        subtotal: 9.00,
        adicionadoEm: '2026-09-01T17:43:00',
        adicionadoPor: 'Matheus Ribeiro'
      }
    ],
    totalBruto: 62.00,
    desconto: 0,
    taxaServico: 0,
    totalLiquido: 62.00,
    pago: true
  }
];

export const comandasPorEmpresa: Record<string, Comanda[]> = {
  'emp-1': comandasEspetinho1,
  'emp-2': comandasEspetinho2,
  'emp-3': comandasTabacaria
};

export const comandasIniciais = comandasEspetinho1;

// ==================== TURNOS POR LOJA ====================

export const turnoEspetinho1: TurnoCaixa = {
  id: 'turno-e1-20260901-01',
  empresaId: 'emp-1',
  numeroTurno: 1,
  operadorAberturaId: 'op-2',
  operadorAberturaNome: 'Juliana Mendes',
  dataHoraAbertura: '2026-09-01T17:00:00',
  saldoInicialSuprimento: 250.00, // R$ 250,00 de fundo de troco
  status: 'ABERTO',
  totalSangrias: 100.00,
  totalSuprimentos: 250.00
};

export const turnoEspetinho2: TurnoCaixa = {
  id: 'turno-e2-20260901-01',
  empresaId: 'emp-2',
  numeroTurno: 1,
  operadorAberturaId: 'op-1',
  operadorAberturaNome: 'Carlos Eduardo',
  dataHoraAbertura: '2026-09-01T16:30:00',
  saldoInicialSuprimento: 200.00, // R$ 200,00 de fundo
  status: 'ABERTO',
  totalSangrias: 50.00,
  totalSuprimentos: 200.00
};

export const turnoTabacaria: TurnoCaixa = {
  id: 'turno-tab-20260901-01',
  empresaId: 'emp-3',
  numeroTurno: 1,
  operadorAberturaId: 'op-3',
  operadorAberturaNome: 'Matheus Ribeiro',
  dataHoraAbertura: '2026-09-01T16:00:00',
  saldoInicialSuprimento: 300.00, // R$ 300,00 de fundo
  status: 'ABERTO',
  totalSangrias: 80.00,
  totalSuprimentos: 300.00
};

export const turnosPorEmpresa: Record<string, TurnoCaixa> = {
  'emp-1': turnoEspetinho1,
  'emp-2': turnoEspetinho2,
  'emp-3': turnoTabacaria
};

export const turnoAtualInicial = turnoEspetinho1;

// ==================== MOVIMENTAÇÕES POR LOJA ====================

export const movimentacoesEspetinho1: MovimentacaoCaixa[] = [
  {
    id: 'mov-e1-1',
    turnoId: 'turno-e1-20260901-01',
    tipo: 'ABERTURA',
    descricao: 'Abertura de Caixa - Fundo de Troco Inicial',
    valor: 250.00,
    metodoPagamento: 'DINHEIRO',
    operadorId: 'op-2',
    operadorNome: 'Juliana Mendes',
    timestamp: '2026-09-01T17:00:00'
  },
  {
    id: 'mov-e1-2',
    turnoId: 'turno-e1-20260901-01',
    tipo: 'VENDA',
    descricao: 'Recebimento Comanda #12 (Balcão Rápido)',
    valor: 32.00,
    metodoPagamento: 'PIX',
    operadorId: 'op-2',
    operadorNome: 'Juliana Mendes',
    comandaId: 'cmd-e1-12',
    comandaNumero: 12,
    timestamp: '2026-09-01T17:35:00'
  },
  {
    id: 'mov-e1-3',
    turnoId: 'turno-e1-20260901-01',
    tipo: 'SANGRIA',
    descricao: 'Sangria de Segurança para Cofre (Gerência)',
    valor: 100.00,
    metodoPagamento: 'DINHEIRO',
    operadorId: 'op-admin',
    operadorNome: 'Jackson (Administrador)',
    autorizadoPor: 'Jackson (Administrador)',
    timestamp: '2026-09-01T18:00:00'
  },
  {
    id: 'mov-e1-4',
    turnoId: 'turno-e1-20260901-01',
    tipo: 'VENDA',
    descricao: 'Recebimento Venda Balcão #105 (Espetos & Cervejas)',
    valor: 64.00,
    metodoPagamento: 'DINHEIRO',
    operadorId: 'op-2',
    operadorNome: 'Juliana Mendes',
    timestamp: '2026-09-01T19:00:00'
  }
];

export const movimentacoesEspetinho2: MovimentacaoCaixa[] = [
  {
    id: 'mov-e2-1',
    turnoId: 'turno-e2-20260901-01',
    tipo: 'ABERTURA',
    descricao: 'Abertura de Caixa - Fundo de Troco Inicial',
    valor: 200.00,
    metodoPagamento: 'DINHEIRO',
    operadorId: 'op-1',
    operadorNome: 'Carlos Eduardo',
    timestamp: '2026-09-01T16:30:00'
  },
  {
    id: 'mov-e2-2',
    turnoId: 'turno-e2-20260901-01',
    tipo: 'VENDA',
    descricao: 'Recebimento Balcão Rápido #3 (Espetos Angus)',
    valor: 42.00,
    metodoPagamento: 'PIX',
    operadorId: 'op-1',
    operadorNome: 'Carlos Eduardo',
    comandaId: 'cmd-e2-03',
    comandaNumero: 3,
    timestamp: '2026-09-01T17:25:00'
  },
  {
    id: 'mov-e2-3',
    turnoId: 'turno-e2-20260901-01',
    tipo: 'SANGRIA',
    descricao: 'Sangria Parcial de Caixa',
    valor: 50.00,
    metodoPagamento: 'DINHEIRO',
    operadorId: 'op-admin',
    operadorNome: 'Jackson (Dono)',
    autorizadoPor: 'Jackson (Dono)',
    timestamp: '2026-09-01T17:50:00'
  },
  {
    id: 'mov-e2-4',
    turnoId: 'turno-e2-20260901-01',
    tipo: 'VENDA',
    descricao: 'Venda Balcão #202 (2x Chopp Brahma + Espeto Picanha)',
    valor: 48.00,
    metodoPagamento: 'CARTAO_DEBITO',
    operadorId: 'op-1',
    operadorNome: 'Carlos Eduardo',
    timestamp: '2026-09-01T18:20:00'
  }
];

export const movimentacoesTabacaria: MovimentacaoCaixa[] = [
  {
    id: 'mov-tab-1',
    turnoId: 'turno-tab-20260901-01',
    tipo: 'ABERTURA',
    descricao: 'Abertura de Caixa - Fundo de Troco Lounge',
    valor: 300.00,
    metodoPagamento: 'DINHEIRO',
    operadorId: 'op-3',
    operadorNome: 'Matheus Ribeiro',
    timestamp: '2026-09-01T16:00:00'
  },
  {
    id: 'mov-tab-2',
    turnoId: 'turno-tab-20260901-01',
    tipo: 'VENDA',
    descricao: 'Recebimento Comanda Balcão #8 (Carvão + Essência + Seda)',
    valor: 62.00,
    metodoPagamento: 'PIX',
    operadorId: 'op-3',
    operadorNome: 'Matheus Ribeiro',
    comandaId: 'cmd-tab-08',
    comandaNumero: 8,
    timestamp: '2026-09-01T17:48:00'
  },
  {
    id: 'mov-tab-3',
    turnoId: 'turno-tab-20260901-01',
    tipo: 'SANGRIA',
    descricao: 'Sangria de Segurança para Gerência',
    valor: 80.00,
    metodoPagamento: 'DINHEIRO',
    operadorId: 'op-admin',
    operadorNome: 'Jackson (Dono)',
    autorizadoPor: 'Jackson (Dono)',
    timestamp: '2026-09-01T18:15:00'
  },
  {
    id: 'mov-tab-4',
    turnoId: 'turno-tab-20260901-01',
    tipo: 'VENDA',
    descricao: 'Venda Direta Balcão (Pod Descartável Ignite V50)',
    valor: 110.00,
    metodoPagamento: 'CARTAO_CREDITO',
    operadorId: 'op-3',
    operadorNome: 'Matheus Ribeiro',
    timestamp: '2026-09-01T18:35:00'
  },
  {
    id: 'mov-tab-5',
    turnoId: 'turno-tab-20260901-01',
    tipo: 'VENDA',
    descricao: 'Venda Balcão (2x Essência Zomo Strong Mint + Carvão)',
    valor: 68.00,
    metodoPagamento: 'DINHEIRO',
    operadorId: 'op-3',
    operadorNome: 'Matheus Ribeiro',
    timestamp: '2026-09-01T19:00:00'
  }
];

export const movimentacoesPorEmpresa: Record<string, MovimentacaoCaixa[]> = {
  'emp-1': movimentacoesEspetinho1,
  'emp-2': movimentacoesEspetinho2,
  'emp-3': movimentacoesTabacaria
};

export const movimentacoesIniciais = movimentacoesEspetinho1;
