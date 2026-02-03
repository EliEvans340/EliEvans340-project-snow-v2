import { pgTable, text, timestamp, integer, uuid } from "drizzle-orm/pg-core";

export const radarFrames = pgTable("radar_frames", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Unix timestamp of the radar frame
  frameTime: integer("frame_time").notNull().unique(),
  // RainViewer path (e.g., "/v2/radar/1770135600")
  path: text("path").notNull(),
  // Full tile URL template
  tileUrl: text("tile_url").notNull(),
  // When this frame was cached
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
});

export type RadarFrame = typeof radarFrames.$inferSelect;
export type NewRadarFrame = typeof radarFrames.$inferInsert;
