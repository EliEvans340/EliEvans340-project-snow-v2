CREATE TABLE "resort_conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resort_id" uuid NOT NULL,
	"scraped_at" timestamp DEFAULT now() NOT NULL,
	"scraped_date" date NOT NULL,
	"snow_depth_summit" integer,
	"snow_depth_base" integer,
	"new_snow_24h" integer,
	"new_snow_48h" integer,
	"new_snow_7d" integer,
	"lifts_open" integer,
	"lifts_total" integer,
	"runs_open" integer,
	"runs_total" integer,
	"terrain_open_km" numeric,
	"terrain_total_km" numeric,
	"terrain_open_pct" integer,
	"is_open" integer DEFAULT 0,
	"season_start" date,
	"season_end" date,
	"last_snowfall" date,
	"conditions" text
);
--> statement-breakpoint
CREATE TABLE "resort_info" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resort_id" uuid NOT NULL,
	"elevation_base" integer,
	"elevation_summit" integer,
	"vertical_drop" integer,
	"terrain_total_km" numeric,
	"terrain_easy_km" numeric,
	"terrain_intermediate_km" numeric,
	"terrain_difficult_km" numeric,
	"terrain_easy_pct" integer,
	"terrain_intermediate_pct" integer,
	"terrain_difficult_pct" integer,
	"lifts_total" integer,
	"runs_total" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "resort_info_resort_id_unique" UNIQUE("resort_id")
);
--> statement-breakpoint
ALTER TABLE "resort_conditions" ADD CONSTRAINT "resort_conditions_resort_id_resorts_id_fk" FOREIGN KEY ("resort_id") REFERENCES "public"."resorts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resort_info" ADD CONSTRAINT "resort_info_resort_id_resorts_id_fk" FOREIGN KEY ("resort_id") REFERENCES "public"."resorts"("id") ON DELETE no action ON UPDATE no action;