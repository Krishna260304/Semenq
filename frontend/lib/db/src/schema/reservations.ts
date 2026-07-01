import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { medicinesTable } from "./medicines";
import { pharmaciesTable } from "./pharmacies";

export const reservationsTable = pgTable("reservations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  medicineId: integer("medicine_id").notNull().references(() => medicinesTable.id),
  pharmacyId: integer("pharmacy_id").notNull().references(() => pharmaciesTable.id),
  prescriptionId: integer("prescription_id"),
  quantity: integer("quantity").notNull().default(1),
  price: numeric("price", { precision: 10, scale: 2 }),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("pending"),
  deliveryType: text("delivery_type").notNull().default("pickup"),
  expiresAt: timestamp("expires_at"),
  qrCode: text("qr_code"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertReservationSchema = createInsertSchema(reservationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReservation = z.infer<typeof insertReservationSchema>;
export type Reservation = typeof reservationsTable.$inferSelect;
