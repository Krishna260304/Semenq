import { pgTable, serial, text, boolean, numeric, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pharmaciesTable = pgTable("pharmacies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerName: text("owner_name"),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  pincode: text("pincode"),
  phone: text("phone").notNull(),
  email: text("email"),
  lat: numeric("lat", { precision: 10, scale: 6 }),
  lng: numeric("lng", { precision: 10, scale: 6 }),
  isVerified: boolean("is_verified").default(false),
  rating: numeric("rating", { precision: 3, scale: 1 }).default("4.0"),
  reviewCount: integer("review_count").default(0),
  openTime: text("open_time").default("09:00"),
  closeTime: text("close_time").default("21:00"),
  offersCourier: boolean("offers_courier").default(false),
  licenseNumber: text("license_number"),
  totalInventory: integer("total_inventory").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPharmacySchema = createInsertSchema(pharmaciesTable).omit({ id: true, createdAt: true });
export type InsertPharmacy = z.infer<typeof insertPharmacySchema>;
export type Pharmacy = typeof pharmaciesTable.$inferSelect;
