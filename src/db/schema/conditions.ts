import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  numeric,
  date,
} from "drizzle-orm/pg-core";
import { resorts } from "./resorts";

// Daily snapshot of resort conditions from skiresort.info
export const resortConditions = pgTable("resort_conditions", {
  id: uuid("id").primaryKey().defaultRandom(),
  resortId: uuid("resort_id")
    .references(() => resorts.id)
    .notNull(),

  // When this data was scraped
  scrapedAt: timestamp("scraped_at").defaultNow().notNull(),
  scrapedDate: date("scraped_date").notNull(),

  // Snow conditions (in cm, converted to inches on display)
  snowDepthSummit: integer("snow_depth_summit"),
  snowDepthBase: integer("snow_depth_base"),
  newSnow24h: integer("new_snow_24h"),
  newSnow48h: integer("new_snow_48h"),
  newSnow7d: integer("new_snow_7d"),

  // Operations
  liftsOpen: integer("lifts_open"),
  liftsTotal: integer("lifts_total"),
  runsOpen: integer("runs_open"),
  runsTotal: integer("runs_total"),
  terrainOpenKm: numeric("terrain_open_km"),
  terrainTotalKm: numeric("terrain_total_km"),
  terrainOpenPct: integer("terrain_open_pct"),

  // Status
  isOpen: integer("is_open").default(0), // 0 = closed, 1 = open
  seasonStart: date("season_start"),
  seasonEnd: date("season_end"),

  // Additional info
  lastSnowfall: date("last_snowfall"),
  conditions: text("conditions"), // e.g., "Packed Powder", "Groomed"

  // Operating hours
  firstChair: text("first_chair"), // e.g., "8:30 AM"
  lastChair: text("last_chair"), // e.g., "4:00 PM"
});

// Static resort info (doesn't change often)
export const resortInfo = pgTable("resort_info", {
  id: uuid("id").primaryKey().defaultRandom(),
  resortId: uuid("resort_id")
    .references(() => resorts.id)
    .notNull()
    .unique(),

  // Elevation (in meters)
  elevationBase: integer("elevation_base"),
  elevationSummit: integer("elevation_summit"),
  verticalDrop: integer("vertical_drop"),

  // Terrain
  terrainTotalKm: numeric("terrain_total_km"),
  terrainEasyKm: numeric("terrain_easy_km"),
  terrainIntermediateKm: numeric("terrain_intermediate_km"),
  terrainDifficultKm: numeric("terrain_difficult_km"),
  terrainEasyPct: integer("terrain_easy_pct"),
  terrainIntermediatePct: integer("terrain_intermediate_pct"),
  terrainDifficultPct: integer("terrain_difficult_pct"),

  // Lifts
  liftsTotal: integer("lifts_total"),
  liftsGondolas: integer("lifts_gondolas"),
  liftsChairliftsHighSpeed: integer("lifts_chairlifts_high_speed"),
  liftsChairliftsFixedGrip: integer("lifts_chairlifts_fixed_grip"),
  liftsSurface: integer("lifts_surface"),
  liftsCarpets: integer("lifts_carpets"),

  // Runs
  runsTotal: integer("runs_total"),

  // Last updated
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ResortConditions = typeof resortConditions.$inferSelect;
export type NewResortConditions = typeof resortConditions.$inferInsert;

export type ResortInfo = typeof resortInfo.$inferSelect;
export type NewResortInfo = typeof resortInfo.$inferInsert;
