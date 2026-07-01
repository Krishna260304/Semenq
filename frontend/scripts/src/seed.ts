import { db } from "@workspace/db";
import {
  medicinesTable,
  pharmaciesTable,
  usersTable,
  inventoryTable,
  notificationsTable,
  reservationsTable,
  ordersTable,
  prescriptionsTable,
  parsedMedicinesTable,
} from "@workspace/db";

async function seed() {
  console.log("Seeding database...");

  const users = await db.insert(usersTable).values([
    { name: "Arjun Mehta", email: "arjun.mehta@gmail.com", phone: "+919876543210", role: "patient", city: "Mumbai", state: "Maharashtra", pincode: "400053", address: "402, Shree Sai Apartments, Andheri West", isVerified: true },
    { name: "Sunita Sharma", email: "sunita@apollopharmacy.in", phone: "+918765432109", role: "pharmacy", city: "Mumbai", state: "Maharashtra", pincode: "400050", address: "Ground Floor, Linking Road, Bandra West", isVerified: true },
    { name: "Admin User", email: "admin@semenq.in", phone: "+919999999999", role: "admin", city: "Mumbai", state: "Maharashtra", isVerified: true },
  ]).returning();
  console.log("Users seeded:", users.length);

  const meds = await db.insert(medicinesTable).values([
    { name: "Amoxicillin 500mg", genericName: "Amoxicillin", category: "Antibiotics", manufacturer: "Cipla Ltd", composition: "Amoxicillin Trihydrate 500mg", dosage: "500mg", price: "98.50", mrp: "120.00", requiresPrescription: true },
    { name: "Paracetamol 650mg", genericName: "Paracetamol", category: "Analgesics", manufacturer: "Sun Pharma", composition: "Paracetamol 650mg", dosage: "650mg", price: "24.00", mrp: "30.00", requiresPrescription: false },
    { name: "Metformin 500mg", genericName: "Metformin HCl", category: "Antidiabetics", manufacturer: "USV Ltd", composition: "Metformin Hydrochloride 500mg", dosage: "500mg", price: "42.00", mrp: "55.00", requiresPrescription: true },
    { name: "Atorvastatin 20mg", genericName: "Atorvastatin", category: "Statins", manufacturer: "Lupin Ltd", composition: "Atorvastatin Calcium 20mg", dosage: "20mg", price: "85.00", mrp: "110.00", requiresPrescription: true },
    { name: "Pantoprazole 40mg", genericName: "Pantoprazole", category: "Proton Pump Inhibitors", manufacturer: "Dr. Reddys", composition: "Pantoprazole Sodium 40mg", dosage: "40mg", price: "62.50", mrp: "80.00", requiresPrescription: false },
    { name: "Azithromycin 500mg", genericName: "Azithromycin", category: "Antibiotics", manufacturer: "Alkem Labs", composition: "Azithromycin Dihydrate 500mg", dosage: "500mg", price: "68.00", mrp: "85.00", requiresPrescription: true },
    { name: "Cetirizine 10mg", genericName: "Cetirizine HCl", category: "Antihistamines", manufacturer: "Mankind Pharma", composition: "Cetirizine Hydrochloride 10mg", dosage: "10mg", price: "18.50", mrp: "25.00", requiresPrescription: false },
    { name: "Losartan 50mg", genericName: "Losartan Potassium", category: "Antihypertensives", manufacturer: "Torrent Pharma", composition: "Losartan Potassium 50mg", dosage: "50mg", price: "78.00", mrp: "95.00", requiresPrescription: true },
    { name: "Omeprazole 20mg", genericName: "Omeprazole", category: "Proton Pump Inhibitors", manufacturer: "Zydus Cadila", composition: "Omeprazole 20mg", dosage: "20mg", price: "35.00", mrp: "45.00", requiresPrescription: false },
    { name: "Montelukast 10mg", genericName: "Montelukast Sodium", category: "Antiasthmatics", manufacturer: "Glenmark", composition: "Montelukast Sodium 10mg", dosage: "10mg", price: "115.00", mrp: "145.00", requiresPrescription: true },
  ]).returning();
  console.log("Medicines seeded:", meds.length);

  const phs = await db.insert(pharmaciesTable).values([
    { name: "MedPlus Pharmacy - Andheri West", ownerName: "Rajesh Patel", address: "Shop 12, Lokhandwala Complex, Andheri West", city: "Mumbai", state: "Maharashtra", pincode: "400053", phone: "+919876543210", email: "andheri@medplus.in", lat: "19.1334", lng: "72.8263", isVerified: true, rating: "4.8", reviewCount: 342, openTime: "08:00", closeTime: "22:00", offersCourier: true, licenseNumber: "MH-MUM-2019-08821", totalInventory: 2847 },
    { name: "Apollo Pharmacy - Bandra", ownerName: "Sunita Sharma", address: "Ground Floor, Linking Road, Bandra West", city: "Mumbai", state: "Maharashtra", pincode: "400050", phone: "+918765432109", email: "bandra@apollopharmacy.in", lat: "19.0596", lng: "72.8347", isVerified: true, rating: "4.7", reviewCount: 218, openTime: "07:00", closeTime: "23:00", offersCourier: true, licenseNumber: "MH-MUM-2018-07234", totalInventory: 3241 },
    { name: "Jan Aushadhi Kendra - Dadar", ownerName: "Anil Kumar", address: "Shop 5, Dadar Railway Station Complex", city: "Mumbai", state: "Maharashtra", pincode: "400014", phone: "+917654321098", email: "dadar@janaushadhi.gov.in", lat: "19.0178", lng: "72.8478", isVerified: true, rating: "4.5", reviewCount: 89, openTime: "09:00", closeTime: "20:00", offersCourier: false, licenseNumber: "MH-MUM-2020-11567", totalInventory: 1203 },
    { name: "Wellness Forever - Pune", ownerName: "Priya Kulkarni", address: "FC Road, Near Fergusson College", city: "Pune", state: "Maharashtra", pincode: "411004", phone: "+916543210987", email: "fcroad@wellnessforever.in", lat: "18.5204", lng: "73.8567", isVerified: true, rating: "4.6", reviewCount: 156, openTime: "09:00", closeTime: "21:00", offersCourier: true, licenseNumber: "MH-PUN-2019-05432", totalInventory: 2108 },
    { name: "Netmeds Point - Bengaluru", ownerName: "Karthik Reddy", address: "100 Feet Road, Indiranagar", city: "Bengaluru", state: "Karnataka", pincode: "560038", phone: "+915432109876", email: "indiranagar@netmeds.com", lat: "12.9784", lng: "77.6408", isVerified: true, rating: "4.9", reviewCount: 423, openTime: "08:00", closeTime: "22:00", offersCourier: true, licenseNumber: "KA-BLR-2020-09871", totalInventory: 4102 },
  ]).returning();
  console.log("Pharmacies seeded:", phs.length);

  const inventoryItems = [];
  for (const ph of phs) {
    for (const med of meds) {
      const qty = Math.floor(Math.random() * 200);
      inventoryItems.push({
        pharmacyId: ph.id,
        medicineId: med.id,
        quantity: qty,
        price: med.price,
        mrp: med.mrp,
        expiryDate: "2027-06-30",
        batchNumber: `BT${Date.now()}${Math.floor(Math.random() * 999)}`,
        reorderLevel: 20,
      });
    }
  }
  await db.insert(inventoryTable).values(inventoryItems);
  console.log("Inventory seeded:", inventoryItems.length, "items");

  if (users[0]) {
    await db.insert(notificationsTable).values([
      { userId: users[0].id, type: "success", title: "Reservation Confirmed", message: "Your reservation for Metformin 500mg at Apollo Pharmacy Bandra is confirmed.", isRead: false, actionLabel: "View QR", actionUrl: "/patient/orders/1" },
      { userId: users[0].id, type: "aiInsight", title: "AI Refill Reminder", message: "You're likely running low on Metformin 500mg. Reserve now before stock runs out.", isRead: false, actionLabel: "Search Medicines", actionUrl: "/patient/search" },
      { userId: users[0].id, type: "warning", title: "Reservation Expiring Soon", message: "Your reservation for Atorvastatin 20mg at MedPlus Andheri expires in 2 hours.", isRead: false, actionLabel: "Pay Now", actionUrl: "/patient/orders/2" },
      { userId: users[0].id, type: "info", title: "Order Dispatched", message: "Your courier order of Amoxicillin 500mg has been dispatched. Delivery tomorrow by 7 PM.", isRead: true, actionLabel: "Track Order", actionUrl: "/patient/orders/3" },
    ]);
    console.log("Notifications seeded");

    if (meds[2]) {
      const [rx] = await db.insert(prescriptionsTable).values({
        userId: users[0].id,
        doctorName: "Dr. Ananya Sharma",
        patientName: "Arjun Mehta",
        hospitalName: "Apollo Hospitals, Mumbai",
        status: "parsed",
        overallConfidence: "94.2",
      }).returning();

      if (rx) {
        await db.insert(parsedMedicinesTable).values([
          { prescriptionId: rx.id, name: "Metformin 500mg", dosage: "500mg", frequency: "Twice daily", duration: "3 months", confidence: "97", matchedMedicineId: meds[2].id, status: "confirmed" },
          { prescriptionId: rx.id, name: "Atorvastatin 20mg", dosage: "20mg", frequency: "Once daily", duration: "3 months", confidence: "92", matchedMedicineId: meds[3]?.id ?? null, status: "confirmed" },
          { prescriptionId: rx.id, name: "Pantoprazole 40mg", dosage: "40mg", frequency: "Once daily", duration: "1 month", confidence: "88", matchedMedicineId: meds[4]?.id ?? null, status: "confirmed" },
        ]);
        console.log("Prescription seeded");
      }
    }

    if (meds[2] && phs[1]) {
      const [r1] = await db.insert(reservationsTable).values({
        userId: users[0].id,
        medicineId: meds[2].id,
        pharmacyId: phs[1].id,
        quantity: 2,
        price: "42.00",
        totalAmount: "84.00",
        status: "confirmed",
        deliveryType: "pickup",
        expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
        qrCode: "QR" + Date.now(),
      }).returning();

      if (r1) {
        await db.insert(ordersTable).values({
          userId: users[0].id,
          reservationId: r1.id,
          status: "shipped",
          deliveryType: "courier",
          totalAmount: "197.00",
          paymentMethod: "UPI",
          paymentStatus: "paid",
          deliveryAddress: "402, Shree Sai Apartments, Andheri West, Mumbai - 400053",
          trackingId: "NM20260628A1",
          estimatedDelivery: "Tomorrow by 7 PM",
        });
        console.log("Order seeded");
      }
    }
  }

  console.log("Database seeded successfully!");
}

seed().catch(console.error).finally(() => process.exit(0));
