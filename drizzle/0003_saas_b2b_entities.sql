-- 0003_saas_b2b_entities.sql
-- Adiciona campos e tabelas para a Fase 2 (SaaS B2B Multi-tenant, Planos, Subscriptions, Convites)

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "legal_name" text;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "trade_name" text;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "email" text;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "phone" text;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'TRIAL' NOT NULL;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "plan_id" text DEFAULT 'TRIAL' NOT NULL;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "subscription_status" text DEFAULT 'TRIAL' NOT NULL;
--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "name" text;
--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "code" text;
--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'ACTIVE' NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'ACTIVE' NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"invitation_id" text NOT NULL UNIQUE,
	"tenant_id" text NOT NULL,
	"store_id" text,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"revoked_at" timestamp,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"description" text,
	"monthly_price" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"annual_price" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"max_stores" integer DEFAULT 1 NOT NULL,
	"max_users" integer DEFAULT 5 NOT NULL,
	"max_products" integer DEFAULT 100 NOT NULL,
	"max_monthly_sales" integer DEFAULT 500 NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL UNIQUE,
	"tenant_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"status" text DEFAULT 'TRIAL' NOT NULL,
	"provider" text DEFAULT 'MANUAL' NOT NULL,
	"external_subscription_id" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"current_period_start" timestamp DEFAULT now() NOT NULL,
	"current_period_end" timestamp,
	"canceled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_invitations_tenant_idx" ON "user_invitations" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_invitations_email_idx" ON "user_invitations" ("email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_tenant_idx" ON "subscriptions" ("tenant_id");
