import { pgTable, serial, text, boolean, numeric, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const medicinesTable = pgTable("medicines", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  genericName: text("generic_name").notNull(),
  category: text("category").notNull(),
  manufacturer: text("manufacturer").notNull(),
  composition: text("composition"),
  dosage: text("dosage"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  mrp: numeric("mrp", { precision: 10, scale: 2 }),
  imageUrl: text("image_url"),
  requiresPrescription: boolean("requires_prescription").default(false),
  description: text("description"),
  sideEffects: text("side_effects"),
  storageConditions: text("storage_conditions"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMedicineSchema = createInsertSchema(medicinesTable).omit({ id: true, createdAt: true });
export type InsertMedicine = z.infer<typeof insertMedicineSchema>;
export type Medicine = typeof medicinesTable.$inferSelect;
