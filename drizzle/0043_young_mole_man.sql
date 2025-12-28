CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"handle" text NOT NULL,
	"parent_id" text,
	"level" integer DEFAULT 0 NOT NULL,
	"full_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "categories_level_idx" ON "categories" USING btree ("level");--> statement-breakpoint
CREATE INDEX "categories_handle_idx" ON "categories" USING btree ("handle");