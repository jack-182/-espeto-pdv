import { relations } from 'drizzle-orm';
import { 
  pgTable, 
  serial, 
  text, 
  timestamp, 
  numeric, 
  integer, 
  boolean, 
  jsonb,
  uniqueIndex
} from 'drizzle-orm/pg-core';

// ============================================================================
// 1. TENANTS & MULTI-UNIDADES (ESTABELECIMENTOS / LOJAS)
// ============================================================================

export const tenants = pgTable('tenants', {
  id: serial('id').primaryKey(),
  tenantId: text('tenant_id').notNull().unique(), // ex: 'tenant-default', 'empresa-xyz'
  name: text('name').notNull(),
  legalName: text('legal_name'), // Razão Social
  tradeName: text('trade_name'), // Nome Fantasia
  slug: text('slug').notNull(),
  cnpj: text('cnpj'),
  email: text('email'),
  phone: text('phone'),
  status: text('status').default('TRIAL').notNull(), // 'TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELED', 'EXPIRED'
  planId: text('plan_id').default('TRIAL').notNull(), // 'TRIAL', 'FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'
  plan: text('plan').default('ENTERPRISE'),
  trialEndsAt: timestamp('trial_ends_at'),
  subscriptionStatus: text('subscription_status').default('TRIAL').notNull(), // 'TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED', 'EXPIRED'
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const stores = pgTable('stores', {
  id: serial('id').primaryKey(),
  storeId: text('store_id').notNull().unique(), // ex: 'emp-1', 'emp-2', 'emp-3'
  tenantId: text('tenant_id').notNull(),
  name: text('name'),
  code: text('code'), // ex: 'LOJA-01', 'MATRIZ-01'
  tradeName: text('trade_name').notNull(), // Nome Fantasia
  corporateName: text('corporate_name').notNull(), // Razão Social
  cnpj: text('cnpj').notNull(),
  segment: text('segment').notNull(), // 'ESPETINHO', 'TABACARIA', 'BAR_RESTAURANTE', 'GERAL'
  address: text('address').notNull(),
  phone: text('phone').notNull(),
  status: text('status').default('ACTIVE').notNull(), // 'ACTIVE', 'INACTIVE'
  serviceTaxDefault: numeric('service_tax_default', { precision: 5, scale: 2 }).default('0').notNull(),
  comandaLimitBlock: numeric('comanda_limit_block', { precision: 10, scale: 2 }).default('600.00').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const terminals = pgTable('terminals', {
  id: serial('id').primaryKey(),
  terminalId: text('terminal_id').notNull().unique(),
  tenantId: text('tenant_id').notNull(),
  storeId: text('store_id').notNull(),
  name: text('name').notNull(),
  code: text('code').notNull(), // ex: 'CAIXA-01', 'BALCAO-02'
  status: text('status').default('ACTIVE').notNull(), // 'ACTIVE', 'LOCKED', 'OFFLINE'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// 2. USUÁRIOS & RBAC (PERMISSÕES E ALÇADAS DE SEGURANÇA)
// ============================================================================

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  tenantId: text('tenant_id').notNull(),
  storeId: text('store_id'), // Loja preferencial (ou null para acesso multi-loja)
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  role: text('role').notNull().default('OPERADOR'), // 'OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR', 'CASHIER', 'STOCK', 'REPORT', 'VIEWER', 'PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMINISTRADOR', 'GERENTE', 'CAIXA', 'OPERADOR'
  status: text('status').default('ACTIVE').notNull(), // 'ACTIVE', 'INACTIVE', 'SUSPENDED'
  pinHash: text('pin_hash'), // Hash do PIN numérico de 4-6 dígitos para liberação rápida no PDV
  active: boolean('active').default(true).notNull(),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// 2.1 CONVITES DE USUÁRIOS (SaaS B2B)
// ============================================================================

export const userInvitations = pgTable('user_invitations', {
  id: serial('id').primaryKey(),
  invitationId: text('invitation_id').notNull().unique(),
  tenantId: text('tenant_id').notNull(),
  storeId: text('store_id'),
  email: text('email').notNull(),
  role: text('role').notNull(), // 'OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR', 'CASHIER', 'STOCK', 'REPORT', 'VIEWER'
  tokenHash: text('token_hash').notNull(), // SHA-256 do token gerado para segurança estrita
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  revokedAt: timestamp('revoked_at'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// 2.2 PLANOS E ASSINATURAS SaaS (SaaS B2B)
// ============================================================================

export const plans = pgTable('plans', {
  id: serial('id').primaryKey(),
  planId: text('plan_id').notNull().unique(), // 'TRIAL', 'FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'
  name: text('name').notNull(),
  description: text('description'),
  monthlyPrice: numeric('monthly_price', { precision: 10, scale: 2 }).default('0.00').notNull(),
  annualPrice: numeric('annual_price', { precision: 10, scale: 2 }).default('0.00').notNull(),
  maxStores: integer('max_stores').default(1).notNull(),
  maxUsers: integer('max_users').default(5).notNull(),
  maxProducts: integer('max_products').default(100).notNull(),
  maxMonthlySales: integer('max_monthly_sales').default(500).notNull(),
  features: jsonb('features').default([]).notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  subscriptionId: text('subscription_id').notNull().unique(),
  tenantId: text('tenant_id').notNull(),
  planId: text('plan_id').notNull(),
  status: text('status').default('TRIAL').notNull(), // 'TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED', 'EXPIRED'
  provider: text('provider').default('MANUAL').notNull(), // Abstraído para gateway futuro (ex: 'MANUAL', 'STRIPE', 'ASAAS')
  externalSubscriptionId: text('external_subscription_id'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  currentPeriodStart: timestamp('current_period_start').defaultNow().notNull(),
  currentPeriodEnd: timestamp('current_period_end'),
  canceledAt: timestamp('canceled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// 3. CATÁLOGO DE PRODUTOS & INVENTÁRIO
// ============================================================================

export const productCategories = pgTable('product_categories', {
  id: serial('id').primaryKey(),
  categoryId: text('category_id').notNull().unique(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  color: text('color'),
  icon: text('icon'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  productId: text('product_id').notNull().unique(),
  tenantId: text('tenant_id').notNull(),
  categoryId: text('category_id').notNull(),
  barcode: text('barcode'),
  sku: text('sku'),
  name: text('name').notNull(),
  unit: text('unit').default('UN').notNull(), // 'UN', 'KG', 'L', 'DOSE', 'PACOTE'
  costPrice: numeric('cost_price', { precision: 12, scale: 2 }).default('0.00').notNull(),
  salePrice: numeric('sale_price', { precision: 12, scale: 2 }).default('0.00').notNull(),
  marginPercent: numeric('margin_percent', { precision: 7, scale: 2 }).default('0.00').notNull(),
  stockMin: integer('stock_min').default(10).notNull(),
  stockMax: integer('stock_max').default(1000).notNull(),
  isQuickSale: boolean('is_quick_sale').default(false).notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const storeInventories = pgTable('store_inventories', {
  id: serial('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  storeId: text('store_id').notNull(),
  productId: text('product_id').notNull(),
  currentStock: integer('current_stock').default(0).notNull(),
  salePriceCustom: numeric('sale_price_custom', { precision: 12, scale: 2 }), // Preço customizado por loja
  minStock: integer('min_stock').default(10).notNull(),
  maxStock: integer('max_stock').default(1000).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const stockMovements = pgTable('stock_movements', {
  id: serial('id').primaryKey(),
  movementId: text('movement_id').notNull().unique(),
  tenantId: text('tenant_id').notNull(),
  storeId: text('store_id').notNull(),
  productId: text('product_id').notNull(),
  movementType: text('movement_type').notNull(), // 'PURCHASE', 'SALE', 'RETURN', 'LOSS', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'CANCELLED_SALE'
  quantity: integer('quantity').notNull(), // Positivo para entrada, negativo para saída
  previousStock: integer('previous_stock').notNull(),
  newStock: integer('new_stock').notNull(),
  reason: text('reason').notNull(),
  orderId: text('order_id'),
  operatorId: text('operator_id').notNull(),
  operatorName: text('operator_name').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// ============================================================================
// 4. CLIENTES
// ============================================================================

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  customerId: text('customer_id').notNull().unique(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  document: text('document'), // CPF/CNPJ
  phone: text('phone'),
  email: text('email'),
  creditLimit: numeric('credit_limit', { precision: 10, scale: 2 }).default('0.00'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// 5. CAIXA & TURNOS OPERACIONAIS
// ============================================================================

export const cashSessions = pgTable('cash_sessions', {
  id: serial('id').primaryKey(),
  sessionId: text('session_id').notNull().unique(),
  tenantId: text('tenant_id').notNull(),
  storeId: text('store_id').notNull(),
  terminalId: text('terminal_id'),
  sessionNumber: integer('session_number').notNull(),
  operatorId: text('operator_id').notNull(),
  operatorName: text('operator_name').notNull(),
  initialFund: numeric('initial_fund', { precision: 12, scale: 2 }).default('0.00').notNull(), // Fundo de troco
  status: text('status').default('ABERTO').notNull(), // 'ABERTO', 'EM_CONFERENCIA', 'FECHADO'
  openedAt: timestamp('opened_at').defaultNow().notNull(),
  closedAt: timestamp('closed_at'),
  declaredCash: numeric('declared_cash', { precision: 12, scale: 2 }),
  declaredPix: numeric('declared_pix', { precision: 12, scale: 2 }),
  declaredCard: numeric('declared_card', { precision: 12, scale: 2 }),
  systemCash: numeric('system_cash', { precision: 12, scale: 2 }).default('0.00').notNull(),
  systemPix: numeric('system_pix', { precision: 12, scale: 2 }).default('0.00').notNull(),
  systemCard: numeric('system_card', { precision: 12, scale: 2 }).default('0.00').notNull(),
  cashDifference: numeric('cash_difference', { precision: 12, scale: 2 }),
  notes: text('notes'),
});

export const cashMovements = pgTable('cash_movements', {
  id: serial('id').primaryKey(),
  movementId: text('movement_id').notNull().unique(),
  tenantId: text('tenant_id').notNull(),
  storeId: text('store_id').notNull(),
  sessionId: text('session_id').notNull(),
  type: text('type').notNull(), // 'ABERTURA', 'VENDA', 'SANGRIA', 'SUPRIMENTO', 'ESTORNO', 'FECHAMENTO'
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text('payment_method').default('DINHEIRO').notNull(),
  reason: text('reason').notNull(),
  operatorId: text('operator_id').notNull(),
  operatorName: text('operator_name').notNull(),
  authorizedBy: text('authorized_by'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// ============================================================================
// 6. VENDAS, COMANDAS E ITENS
// ============================================================================

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderId: text('order_id').notNull().unique(), // ex: 'cmd-emp-1-104', 'venda-balcao-123'
  tenantId: text('tenant_id').notNull(),
  storeId: text('store_id').notNull(),
  sessionId: text('session_id'),
  orderNumber: integer('order_number').notNull(), // Número da Mesa ou Cartão Comanda
  type: text('type').default('MESA').notNull(), // 'MESA', 'COMANDA_CARTAO', 'BALCAO_RAPIDO', 'DELIVERY'
  status: text('status').default('OPEN').notNull(), // 'OPEN', 'PENDING_PAYMENT', 'PAID', 'CANCELLED'
  customerId: text('customer_id'),
  customerName: text('customer_name'),
  operatorId: text('operator_id').notNull(),
  operatorName: text('operator_name').notNull(),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).default('0.00').notNull(),
  discount: numeric('discount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  serviceTax: numeric('service_tax', { precision: 12, scale: 2 }).default('0.00').notNull(),
  total: numeric('total', { precision: 12, scale: 2 }).default('0.00').notNull(),
  openedAt: timestamp('opened_at').defaultNow().notNull(),
  closedAt: timestamp('closed_at'),
  cancelledAt: timestamp('cancelled_at'),
  cancelReason: text('cancel_reason'),
  cancelledBy: text('cancelled_by'),
});

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  itemId: text('item_id').notNull().unique(),
  orderId: text('order_id').notNull(),
  tenantId: text('tenant_id').notNull(),
  storeId: text('store_id').notNull(),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  discount: numeric('discount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  total: numeric('total', { precision: 12, scale: 2 }).notNull(),
  addedBy: text('added_by').notNull(),
  addedAt: timestamp('added_at').defaultNow().notNull(),
  status: text('status').default('ACTIVE').notNull(), // 'ACTIVE', 'CANCELLED'
  cancelledReason: text('cancelled_reason'),
  cancelledBy: text('cancelled_by'),
});

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  paymentId: text('payment_id').notNull().unique(),
  tenantId: text('tenant_id').notNull(),
  storeId: text('store_id').notNull(),
  orderId: text('order_id').notNull(),
  sessionId: text('session_id'),
  method: text('method').notNull(), // 'DINHEIRO', 'PIX', 'CARTAO_DEBITO', 'CARTAO_CREDITO', 'OUTROS'
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  receivedAmount: numeric('received_amount', { precision: 12, scale: 2 }),
  changeAmount: numeric('change_amount', { precision: 12, scale: 2 }).default('0.00'),
  transactionRef: text('transaction_ref'),
  status: text('status').default('CONFIRMED').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// 7. AUDITORIA, NOTIFICAÇÕES & INSIGHTS DE IA
// ============================================================================

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  storeId: text('store_id'),
  userId: text('user_id').notNull(),
  userName: text('user_name').notNull(),
  action: text('action').notNull(), // 'LOGIN', 'VENDA_CRIADA', 'SANGRIA', 'SUPRIMENTO', 'CANCELAMENTO_ITEM', 'FECHAMENTO_CAIXA', etc.
  entity: text('entity').notNull(), // 'orders', 'cash_sessions', 'products', etc.
  entityId: text('entity_id').notNull(),
  oldValues: jsonb('old_values'),
  newValues: jsonb('new_values'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  notificationId: text('notification_id').notNull().unique(),
  tenantId: text('tenant_id').notNull(),
  storeId: text('store_id'),
  type: text('type').notNull(), // 'VENDA', 'SANGRIA', 'SUPRIMENTO', 'CANCELAMENTO_ITEM', 'ALERTA_FRAUDE'
  level: text('level').default('NORMAL').notNull(), // 'NORMAL', 'ATENCAO', 'CRITICO'
  title: text('title').notNull(),
  message: text('message').notNull(),
  details: text('details'),
  read: boolean('read').default(false).notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

export const aiInsights = pgTable('ai_insights', {
  id: serial('id').primaryKey(),
  insightId: text('insight_id').notNull().unique(),
  tenantId: text('tenant_id').notNull(),
  storeId: text('store_id'),
  category: text('category').notNull(), // 'SALES_DROP', 'UNUSUAL_CANCELLATION', 'DEMAND_FORECAST', 'STOCK_RUPTURE', 'MARGIN_OPTIMIZATION'
  title: text('title').notNull(),
  analysis: text('analysis').notNull(),
  recommendations: text('recommendations').notNull(),
  severity: text('severity').default('INFO').notNull(), // 'INFO', 'WARNING', 'CRITICAL'
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const systemSettings = pgTable('system_settings', {
  id: serial('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  settingKey: text('setting_key').notNull(),
  settingValue: jsonb('setting_value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const idempotencyKeys = pgTable('idempotency_keys', {
  id: serial('id').primaryKey(),
  key: text('key').notNull(),
  tenantId: text('tenant_id').notNull(),
  storeId: text('store_id'),
  requestPath: text('request_path').notNull(),
  fingerprint: text('fingerprint'), // SHA-256 hash determinístico da requisição
  statusCode: integer('status_code').notNull(),
  responseBody: jsonb('response_body').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idempotency_keys_tenant_key_idx').on(table.tenantId, table.key)
]);

export const rateLimitBuckets = pgTable('rate_limit_buckets', {
  id: serial('id').primaryKey(),
  key: text('key').notNull(),
  scope: text('scope').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  windowStartedAt: timestamp('window_started_at', { withTimezone: true }).defaultNow().notNull(),
  blockedUntil: timestamp('blocked_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('rate_limit_buckets_key_scope_idx').on(table.key, table.scope)
]);

// ============================================================================
// RELACIONAMENTOS (DRIZZLE RELATIONS)
// ============================================================================

export const storesRelations = relations(stores, ({ many }) => ({
  inventories: many(storeInventories),
  orders: many(orders),
  cashSessions: many(cashSessions),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  store: one(stores, {
    fields: [orders.storeId],
    references: [stores.storeId],
  }),
  items: many(orderItems),
  payments: many(payments),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.orderId],
  }),
}));
