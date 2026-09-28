export type UserRole = 
  | 'OWNER'
  | 'ADMIN'
  | 'MANAGER'
  | 'SUPERVISOR'
  | 'CASHIER'
  | 'STOCK'
  | 'REPORT'
  | 'VIEWER'
  | 'PLATFORM_ADMIN'
  | 'SUPER_ADMIN' 
  | 'ADMINISTRADOR' 
  | 'GERENTE' 
  | 'FINANCEIRO' 
  | 'ESTOQUISTA' 
  | 'CAIXA' 
  | 'OPERADOR';

export type Role = UserRole;

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELED' | 'EXPIRED';
export type TenantStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELED' | 'EXPIRED';

export interface Plan {
  id?: number;
  planId: string;
  name: string;
  description?: string;
  monthlyPrice: number;
  annualPrice: number;
  maxStores: number;
  maxUsers: number;
  maxProducts: number;
  maxMonthlySales: number;
  features: string[];
  active: boolean;
}

export interface Subscription {
  id?: number;
  subscriptionId: string;
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  provider: string;
  externalSubscriptionId?: string;
  startedAt: string;
  currentPeriodStart: string;
  currentPeriodEnd?: string;
  canceledAt?: string;
}

export interface TenantInfo {
  id?: number;
  tenantId: string;
  name: string;
  legalName?: string;
  tradeName?: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  status: TenantStatus;
  planId: string;
  trialEndsAt?: string;
  subscriptionStatus: SubscriptionStatus;
  active: boolean;
  createdAt?: string;
}

export interface UserInvitation {
  id?: number;
  invitationId: string;
  tenantId: string;
  storeId?: string;
  email: string;
  role: UserRole;
  expiresAt: string;
  acceptedAt?: string;
  revokedAt?: string;
  createdBy: string;
  createdAt: string;
}

export interface Operador {
  id: string;
  nome: string;
  cargo: string;
  role: UserRole;
  avatar?: string;
  lojaId?: string;
  email?: string;
  active?: boolean;
}

export interface Empresa {
  id: string;
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  segmento: 'TABACARIA' | 'ESPETINHO' | 'BAR_RESTAURANTE' | 'CONVENIENCIA';
  endereco: string;
  telefone: string;
  taxaServicoPadrao: number; // ex: 10%
  bloqueioLimiteComanda: number; // limite em R$ para alerta de comanda alta
}

export type CategoriaProduto = 
  | 'ESPETOS'
  | 'BEBIDAS_ALCOOLICAS'
  | 'BEBIDAS_NAO_ALCOOLICAS'
  | 'PORCOES'
  | 'ESSENCIAS_NARGHILE'
  | 'CARVAO_ALUMINIO'
  | 'CIGARROS_FUMOS'
  | 'PODS_VAPES'
  | 'COMBOS';

export interface Produto {
  id: string;
  codigoBarras?: string;
  nome: string;
  categoria: CategoriaProduto;
  precoVenda: number;
  precoCusto: number;
  estoqueAtual: number;
  estoqueMinimo: number;
  unidade: 'UN' | 'KG' | 'L' | 'DOSE' | 'PACOTE';
  atalhoRapido?: boolean;
  corTag?: string;
}

export type StatusComanda = 'ABERTA' | 'EM_FECHAMENTO' | 'PAGA' | 'CANCELADA';

export interface ItemComanda {
  id: string;
  produtoId: string;
  nomeProduto: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
  adicionadoEm: string; // ISO string
  adicionadoPor: string; // Nome do operador
  observacao?: string;
}

export interface Comanda {
  id: string;
  numero: number; // Ex: Comanda 12 ou Mesa 04
  tipo: 'MESA' | 'COMANDA_CARTAO' | 'BALCAO_RAPIDO' | 'DELIVERY';
  clienteNome?: string;
  status: StatusComanda;
  itens: ItemComanda[];
  abertaEm: string;
  abertaPor: string;
  fechadaEm?: string;
  totalBruto: number;
  desconto: number;
  taxaServico: number;
  totalLiquido: number;
  pago: boolean;
}

export type MetodoPagamento = 
  | 'DINHEIRO'
  | 'PIX'
  | 'CARTAO_DEBITO'
  | 'CARTAO_CREDITO'
  | 'VALE_REFEICAO'
  | 'FIADO_CONVENIO';

export interface PagamentoItem {
  metodo: MetodoPagamento;
  valor: number;
  detalhes?: string;
}

export type TipoMovimentacaoCaixa = 'ABERTURA' | 'VENDA' | 'SANGRIA' | 'SUPRIMENTO' | 'ESTORNO' | 'FECHAMENTO';

export interface MovimentacaoCaixa {
  id: string;
  turnoId: string;
  tipo: TipoMovimentacaoCaixa;
  descricao: string;
  valor: number;
  metodoPagamento?: MetodoPagamento;
  operadorId: string;
  operadorNome: string;
  comandaId?: string;
  comandaNumero?: number;
  timestamp: string;
  autorizadoPor?: string;
  motivo?: string;
}

export type StatusTurno = 'ABERTO' | 'FECHADO';

export interface TurnoCaixa {
  id: string;
  empresaId: string;
  numeroTurno: number;
  operadorAberturaId: string;
  operadorAberturaNome: string;
  dataHoraAbertura: string;
  saldoInicialSuprimento: number; // Fundo de troco
  status: StatusTurno;
  
  // Fechamento
  operadorFechamentoId?: string;
  operadorFechamentoNome?: string;
  dataHoraFechamento?: string;
  
  // Conferência cega (Declarado pelo operador)
  valoresDeclarados?: Record<MetodoPagamento, number>;
  
  // Valores calculados pelo sistema
  valoresSistema?: Record<MetodoPagamento, number>;
  
  totalSangrias: number;
  totalSuprimentos: number;
  diferencaTotal?: number; // quebra ou sobra
  observacoesFechamento?: string;
}

export type ModuloNavegacao = 
  | 'DASHBOARD'
  | 'PAINEL_ADMIN'
  | 'COMANDAS'
  | 'PDV_RAPIDO'
  | 'CAIXA_TURNO'
  | 'FECHAMENTO'
  | 'PRODUTOS'
  | 'CONFIGURACOES'
  | 'EMPRESA_LOJAS'
  | 'USUARIOS_CONVITES'
  | 'PLANOS_ASSINATURA'
  | 'SUPER_ADMIN_PLATAFORMA'
  | 'RELATORIOS_VENDAS'
  | 'AUDITORIA_LOGS';

// ============================================================================
// TIPOS DE NOTIFICAÇÃO NO CELULAR DO DONO & AUDITORIA ANTI-FRAUDE
// ============================================================================

export type TipoNotificacaoDono = 
  | 'VENDA'
  | 'SANGRIA'
  | 'SUPRIMENTO'
  | 'CANCELAMENTO_ITEM'
  | 'ABERTURA_CAIXA'
  | 'FECHAMENTO_CAIXA'
  | 'ALERTA_FRAUDE';

export type NivelAlertaDono = 'NORMAL' | 'ATENCAO' | 'CRITICO';

export interface NotificacaoDono {
  id: string;
  tipo: TipoNotificacaoDono;
  nivel: NivelAlertaDono;
  titulo: string;
  mensagemWhatsApp: string;
  empresaId: string;
  empresaNome: string;
  valor?: number;
  operadorNome: string;
  detalhes?: string;
  horario: string;
  timestamp: string;
  enviadoParaTelefone: string;
  statusEnvio: 'ENVIADO' | 'PENDENTE' | 'ERRO';
  lido?: boolean;
}

export interface ConfiguracaoNotificacoesDono {
  telefonePrincipal: string;
  telefoneSecundario?: string;
  nomeDono: string;
  notificarVendas: boolean;
  valorMinimoVenda: number; // 0 = todas
  notificarSangrias: boolean;
  notificarSuprimentos: boolean;
  notificarCancelamentos: boolean;
  notificarAberturaFechamento: boolean;
  notificarQuebraCaixa: boolean;
  alertaSonoroAtivo: boolean;
  canalEnvio: 'WHATSAPP_SIMULADO' | 'WHATSAPP_WEBHOOK' | 'PUSH_BROWSER' | 'TODOS';
  webhookUrl?: string;
}
