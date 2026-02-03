CREATE TABLE "resorts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"state" text NOT NULL,
	"region" text,
	"latitude" numeric,
	"longitude" numeric,
	"timezone" text,
	"website_url" text,
	"skiresortinfo_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "resorts_slug_unique" UNIQUE("slug")
);
