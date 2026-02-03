import {
  pgTable,
  text,
  timestamp,
  numeric,
  uuid,
  integer,
} from "drizzle-orm/pg-core";

// Resorts table (mirrors main app schema)
export const resorts = pgTable("resorts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  state: text("state").notNull(),
  region: text("region"),
  latitude: numeric("latitude"),
  longitude: numeric("longitude"),
  timezone: text("timezone"),
  websiteUrl: text("website_url"),
  skiresortinfoId: text("skiresortinfo_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Resort operations table for scraped data
export const resortOperations = pgTable("resort_operations", {
  id: uuid("id").primaryKey().defaultRandom(),
  resortId: uuid("resort_id")
    .references(() => resorts.id)
    .notNull(),
  scrapedAt: timestamp("scraped_at").defaultNow().notNull(),

  // Lifts
  liftsTotal: integer("lifts_total"),
  liftsOpen: integer("lifts_open"),

  // Runs
  runsTotal: integer("runs_total"),
  runsOpen: integer("runs_open"),

  // Terrain
  skiableKm: numeric("skiable_km"),

  // Difficulty breakdown (number of runs by difficulty)
  difficultyEasy: integer("difficulty_easy"),
  difficultyIntermediate: integer("difficulty_intermediate"),
  difficultyAdvanced: integer("difficulty_advanced"),

  // Snow depths (in inches)
  baseDepthInches: numeric("base_depth_inches"),
  summitDepthInches: numeric("summit_depth_inches"),

  // Recent snowfall (in inches)
  snow24hInches: numeric("snow_24h_inches"),
  snow72hInches: numeric("snow_72h_inches"),
});

export type Resort = typeof resorts.$inferSelect;
export type ResortOperation = typeof resortOperations.$inferSelect;
export type NewResortOperation = typeof resortOperations.$inferInsert;
