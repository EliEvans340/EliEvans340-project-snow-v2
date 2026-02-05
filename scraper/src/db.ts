import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  numeric,
  date,
} from "drizzle-orm/pg-core";

// Schema definitions
export const resorts = pgTable("resorts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  state: text("state"),
  region: text("region"),
  latitude: numeric("latitude"),
  longitude: numeric("longitude"),
  timezone: text("timezone"),
  websiteUrl: text("website_url"),
  skiresortinfoId: text("skiresortinfo_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const resortConditions = pgTable("resort_conditions", {
  id: uuid("id").primaryKey().defaultRandom(),
  resortId: uuid("resort_id").references(() => resorts.id).notNull(),
  scrapedAt: timestamp("scraped_at").defaultNow().notNull(),
  scrapedDate: date("scraped_date").notNull(),
  snowDepthSummit: integer("snow_depth_summit"),
  snowDepthBase: integer("snow_depth_base"),
  newSnow24h: integer("new_snow_24h"),
  newSnow48h: integer("new_snow_48h"),
  newSnow7d: integer("new_snow_7d"),
  liftsOpen: integer("lifts_open"),
  liftsTotal: integer("lifts_total"),
  runsOpen: integer("runs_open"),
  runsTotal: integer("runs_total"),
  terrainOpenKm: numeric("terrain_open_km"),
  terrainTotalKm: numeric("terrain_total_km"),
  terrainOpenPct: integer("terrain_open_pct"),
  isOpen: integer("is_open").default(0),
  seasonStart: date("season_start"),
  seasonEnd: date("season_end"),
  lastSnowfall: date("last_snowfall"),
  conditions: text("conditions"),
  firstChair: text("first_chair"),
  lastChair: text("last_chair"),
});

export const resortInfo = pgTable("resort_info", {
  id: uuid("id").primaryKey().defaultRandom(),
  resortId: uuid("resort_id").references(() => resorts.id).notNull().unique(),
  elevationBase: integer("elevation_base"),
  elevationSummit: integer("elevation_summit"),
  verticalDrop: integer("vertical_drop"),
  terrainTotalKm: numeric("terrain_total_km"),
  terrainEasyKm: numeric("terrain_easy_km"),
  terrainIntermediateKm: numeric("terrain_intermediate_km"),
  terrainDifficultKm: numeric("terrain_difficult_km"),
  terrainEasyPct: integer("terrain_easy_pct"),
  terrainIntermediatePct: integer("terrain_intermediate_pct"),
  terrainDifficultPct: integer("terrain_difficult_pct"),
  liftsTotal: integer("lifts_total"),
  liftsGondolas: integer("lifts_gondolas"),
  liftsChairliftsHighSpeed: integer("lifts_chairlifts_high_speed"),
  liftsChairliftsFixedGrip: integer("lifts_chairlifts_fixed_grip"),
  liftsSurface: integer("lifts_surface"),
  liftsCarpets: integer("lifts_carpets"),
  runsTotal: integer("runs_total"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Database connection
export function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const sql = neon(databaseUrl);
  return drizzle(sql);
}
