import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const prescriptionsTable = pgTable("prescriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  doctorName: text("doctor_name"),
  patientName: text("patient_name"),
  hospitalName: text("hospital_name"),
  imageUrl: text("image_url"),
  status: text("status").notNull().default("processing"),
  overallConfidence: numeric("overall_confidence", { precision: 5, scale: 2 }).default("0"),
  notes: text("notes"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const parsedMedicinesTable = pgTable("parsed_medicines", {
  id: serial("id").primaryKey(),
  prescriptionId: integer("prescription_id").notNull().references(() => prescriptionsTable.id),
  name: text("name").notNull(),
  dosage: text("dosage"),
  frequency: text("frequency"),
  duration: text("duration"),
  confidence: numeric("confidence", { precision: 5, scale: 2 }).default("0"),
  matchedMedicineId: integer("matched_medicine_id"),
  status: text("status").notNull().default("confirmed"),
});

export const insertPrescriptionSchema = createInsertSchema(prescriptionsTable).omit({ id: true, uploadedAt: true });
export type InsertPrescription = z.infer<typeof insertPrescriptionSchema>;
export type Prescription = typeof prescriptionsTable.$inferSelect;
