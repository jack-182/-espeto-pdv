CREATE TABLE "ai_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"insight_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"store_id" text,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"analysis" text NOT NULL,
	"recommendations" text NOT NULL,
	"severity" text DEFAULT 'INFO' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_insights_insight_id_unique" UNIQUE("insight_id")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"store_id" text,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"ip_address" text,
	"user_agent" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"movement_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"store_id" text NOT NULL,
	"session_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" text DEFAULT 'DINHEIRO' NOT NULL,
	"reason" text NOT NULL,
	"operator_id" text NOT NULL,
	"operator_name" text NOT NULL,
	"authorized_by" text,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cash_movements_movement_id_unique" UNIQUE("movement_id")
);
--> statement-breakpoint
CREATE TABLE "cash_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"store_id" text NOT NULL,
	"terminal_id" text,
	"session_number" integer NOT NULL,
	"operator_id" text NOT NULL,
	"operator_name" text NOT NULL,
	"initial_fund" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"status" text DEFAULT 'ABERTO' NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"declared_cash" numeric(12, 2),
	"declared_pix" numeric(12, 2),
	"declared_card" numeric(12, 2),
	"system_cash" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"system_pix" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"system_card" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"cash_difference" numeric(12, 2),
	"notes" text,
	CONSTRAINT "cash_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"document" text,
	"phone" text,
	"email" text,
	"credit_limit" numeric(10, 2) DEFAULT '0.00',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customers_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"tenant_id" text NOT NULL,
	"request_path" text NOT NULL,
	"status_code" integer NOT NULL,
	"response_body" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"notification_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"store_id" text,
	"type" text NOT NULL,
	"level" text DEFAULT 'NORMAL' NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"details" text,
	"read" boolean DEFAULT false NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_notification_id_unique" UNIQUE("notification_id")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"order_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"store_id" text NOT NULL,
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"added_by" text NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"cancelled_reason" text,
	"cancelled_by" text,
	CONSTRAINT "order_items_item_id_unique" UNIQUE("item_id")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"store_id" text NOT NULL,
	"session_id" text,
	"order_number" integer NOT NULL,
	"type" text DEFAULT 'MESA' NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"customer_id" text,
	"customer_name" text,
	"operator_id" text NOT NULL,
	"operator_name" text NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"discount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"service_tax" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"cancelled_at" timestamp,
	"cancel_reason" text,
	"cancelled_by" text,
	CONSTRAINT "orders_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"store_id" text NOT NULL,
	"order_id" text NOT NULL,
	"session_id" text,
	"method" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"received_amount" numeric(12, 2),
	"change_amount" numeric(12, 2) DEFAULT '0.00',
	"transaction_ref" text,
	"status" text DEFAULT 'CONFIRMED' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payments_payment_id_unique" UNIQUE("payment_id")
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"color" text,
	"icon" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_categories_category_id_unique" UNIQUE("category_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"category_id" text NOT NULL,
	"barcode" text,
	"sku" text,
	"name" text NOT NULL,
	"unit" text DEFAULT 'UN' NOT NULL,
	"cost_price" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"sale_price" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"margin_percent" numeric(7, 2) DEFAULT '0.00' NOT NULL,
	"stock_min" integer DEFAULT 10 NOT NULL,
	"stock_max" integer DEFAULT 1000 NOT NULL,
	"is_quick_sale" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_product_id_unique" UNIQUE("product_id")
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"movement_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"store_id" text NOT NULL,
	"product_id" text NOT NULL,
	"movement_type" text NOT NULL,
	"quantity" integer NOT NULL,
	"previous_stock" integer NOT NULL,
	"new_stock" integer NOT NULL,
	"reason" text NOT NULL,
	"order_id" text,
	"operator_id" text NOT NULL,
	"operator_name" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_movement_id_unique" UNIQUE("movement_id")
);
--> statement-breakpoint
CREATE TABLE "store_inventories" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"store_id" text NOT NULL,
	"product_id" text NOT NULL,
	"current_stock" integer DEFAULT 0 NOT NULL,
	"sale_price_custom" numeric(12, 2),
	"min_stock" integer DEFAULT 10 NOT NULL,
	"max_stock" integer DEFAULT 1000 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"trade_name" text NOT NULL,
	"corporate_name" text NOT NULL,
	"cnpj" text NOT NULL,
	"segment" text NOT NULL,
	"address" text NOT NULL,
	"phone" text NOT NULL,
	"service_tax_default" numeric(5, 2) DEFAULT '0' NOT NULL,
	"comanda_limit_block" numeric(10, 2) DEFAULT '600.00' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stores_store_id_unique" UNIQUE("store_id")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"cnpj" text,
	"plan" text DEFAULT 'ENTERPRISE',
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "terminals" (
	"id" serial PRIMARY KEY NOT NULL,
	"terminal_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"store_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "terminals_terminal_id_unique" UNIQUE("terminal_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"tenant_id" text NOT NULL,
	"store_id" text,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'OPERADOR' NOT NULL,
	"pin_hash" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_keys_tenant_key_idx" ON "idempotency_keys" USING btree ("tenant_id","key");