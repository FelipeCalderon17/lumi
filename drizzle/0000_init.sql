CREATE TYPE "public"."gap_topic" AS ENUM('hospital-logistics', 'money-and-work', 'family-and-school', 'talking-with-the-care-team', 'caring-for-yourself', 'about-lumi', 'other');--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('en', 'es');--> statement-breakpoint
CREATE TYPE "public"."ledger_outcome" AS ENUM('emergency', 'crisis', 'medical', 'off_topic', 'answer', 'abstained', 'fallback', 'cancelled', 'transcribed', 'notebook');--> statement-breakpoint
CREATE TYPE "public"."model_step" AS ENUM('router', 'answer', 'transcribe', 'notebook', 'judge');--> statement-breakpoint
CREATE TABLE "gap_question" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"language" "language" NOT NULL,
	"topic" "gap_topic" NOT NULL,
	"consent" boolean NOT NULL,
	"delete_token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gap_question_consent_given" CHECK ("gap_question"."consent" = true)
);
--> statement-breakpoint
CREATE TABLE "usage_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"step" "model_step" NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer,
	"cached_input_tokens" integer,
	"output_tokens" integer,
	"reasoning_tokens" integer,
	"audio_seconds" real,
	"latency_ms" integer NOT NULL,
	"finish_reason" text NOT NULL,
	"failure_reason" text,
	"outcome" "ledger_outcome" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "gap_question_created_at_idx" ON "gap_question" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "usage_ledger_created_at_idx" ON "usage_ledger" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "usage_ledger_request_id_idx" ON "usage_ledger" USING btree ("request_id");