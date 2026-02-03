CREATE TABLE "daily_forecasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"forecast_date" date NOT NULL,
	"high_temp_f" numeric,
	"low_temp_f" numeric,
	"snow_total_inches" numeric,
	"wind_avg_mph" numeric,
	"conditions_summary" text
);
--> statement-breakpoint
CREATE TABLE "forecast_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resort_id" uuid NOT NULL,
	"model" text NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"raw_data" jsonb
);
--> statement-breakpoint
CREATE TABLE "hourly_forecasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"forecast_time" timestamp NOT NULL,
	"temp_f" numeric,
	"feels_like_f" numeric,
	"snow_inches" numeric,
	"precip_inches" numeric,
	"wind_mph" numeric,
	"gust_mph" numeric,
	"humidity_pct" integer,
	"conditions" text,
	"freezing_level_ft" integer,
	"snow_level_ft" integer
);
--> statement-breakpoint
ALTER TABLE "daily_forecasts" ADD CONSTRAINT "daily_forecasts_snapshot_id_forecast_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."forecast_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecast_snapshots" ADD CONSTRAINT "forecast_snapshots_resort_id_resorts_id_fk" FOREIGN KEY ("resort_id") REFERENCES "public"."resorts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hourly_forecasts" ADD CONSTRAINT "hourly_forecasts_snapshot_id_forecast_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."forecast_snapshots"("id") ON DELETE no action ON UPDATE no action;