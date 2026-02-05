import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { resorts } from "./resorts";

export const resortPhotos = pgTable("resort_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  resortId: uuid("resort_id")
    .references(() => resorts.id)
    .notNull(),
  unsplashId: text("unsplash_id").notNull(),
  imageUrl: text("image_url").notNull(),
  blurHash: text("blur_hash"),
  altDescription: text("alt_description"),
  photographerName: text("photographer_name").notNull(),
  photographerUrl: text("photographer_url").notNull(),
  unsplashLink: text("unsplash_link").notNull(),
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export type ResortPhoto = typeof resortPhotos.$inferSelect;
export type NewResortPhoto = typeof resortPhotos.$inferInsert;
