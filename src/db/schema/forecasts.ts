import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  integer,
  numeric,
  date,
} from "drizzle-orm/pg-core";
import { resorts } from "./resorts";

export const forecastSnapshots = pgTable("forecast_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  resortId: uuid("resort_id")
    .references(() => resorts.id)
    .notNull(),
  model: text("model").notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  rawData: jsonb("raw_data"),
});

export const hourlyForecasts = pgTable("hourly_forecasts", {
  id: uuid("id").primaryKey().defaultRandom(),
  snapshotId: uuid("snapshot_id")
    .references(() => forecastSnapshots.id)
    .notNull(),
  forecastTime: timestamp("forecast_time").notNull(),
  tempF: numeric("temp_f"),
  feelsLikeF: numeric("feels_like_f"),
  snowInches: numeric("snow_inches"),
  precipInches: numeric("precip_inches"),
  windMph: numeric("wind_mph"),
  gustMph: numeric("gust_mph"),
  humidityPct: integer("humidity_pct"),
  conditions: text("conditions"),
  freezingLevelFt: integer("freezing_level_ft"),
  snowLevelFt: integer("snow_level_ft"),
});

export const dailyForecasts = pgTable("daily_forecasts", {
  id: uuid("id").primaryKey().defaultRandom(),
  snapshotId: uuid("snapshot_id")
    .references(() => forecastSnapshots.id)
    .notNull(),
  forecastDate: date("forecast_date").notNull(),
  highTempF: numeric("high_temp_f"),
  lowTempF: numeric("low_temp_f"),
  snowTotalInches: numeric("snow_total_inches"),
  windAvgMph: numeric("wind_avg_mph"),
  conditionsSummary: text("conditions_summary"),
});

export type ForecastSnapshot = typeof forecastSnapshots.$inferSelect;
export type NewForecastSnapshot = typeof forecastSnapshots.$inferInsert;

export type HourlyForecast = typeof hourlyForecasts.$inferSelect;
export type NewHourlyForecast = typeof hourlyForecasts.$inferInsert;

export type DailyForecast = typeof dailyForecasts.$inferSelect;
export type NewDailyForecast = typeof dailyForecasts.$inferInsert;
