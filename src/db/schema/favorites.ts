import { pgTable, timestamp, uuid, unique } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { resorts } from "./resorts";

export const favorites = pgTable(
  "favorites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    resortId: uuid("resort_id")
      .notNull()
      .references(() => resorts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique("unique_user_resort").on(table.userId, table.resortId)]
);

export type Favorite = typeof favorites.$inferSelect;
export type NewFavorite = typeof favorites.$inferInsert;
