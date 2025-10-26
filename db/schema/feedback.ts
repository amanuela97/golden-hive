import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";

export const feedbacks = pgTable("feedbacks", {
  id: uuid("id").defaultRandom().primaryKey(),
  rating: integer("rating").notNull(),
  message: text("message"),
  suggestions: text("suggestions"),
  createdAt: timestamp("created_at").defaultNow(),
});
