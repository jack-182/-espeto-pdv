ALTER TABLE "idempotency_keys" ADD COLUMN "store_id" text;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD COLUMN "fingerprint" text;