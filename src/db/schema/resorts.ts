import { pgTable, text, timestamp, numeric, uuid } from "drizzle-orm/pg-core";

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

export type Resort = typeof resorts.$inferSelect;
export type NewResort = typeof resorts.$inferInsert;
