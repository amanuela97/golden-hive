CREATE TABLE "feedbacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rating" integer NOT NULL,
	"message" text,
	"suggestions" text,
	"created_at" timestamp DEFAULT now()
);
