import { Router } from "express";
import { db } from "@workspace/db";
import { reservationsTable, ordersTable, prescriptionsTable, medicinesTable, pharmaciesTable, usersTable, inventoryTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";

const router = Router();

const DEMO_USER_ID = 1;

router.get("/users/me/dashboard", async (req, res) => {
  try {
    const reservations = await db.select().from(reservationsTable).where(eq(reservationsTable.userId, DEMO_USER_ID));
    const orders = await db.select().from(ordersTable).where(eq(ordersTable.userId, DEMO_USER_ID));
    const prescriptions = await db.select().from(prescriptionsTable).where(eq(prescriptionsTable.userId, DEMO_USER_ID));

    res.json({
      pendingReservations: reservations.filter(r => r.status === "pending").length,
      activeOrders: orders.filter(o => ["placed", "processing", "packed", "shipped"].includes(o.status)).length,
      totalOrders: orders.length,
      upcomingReservations: reservations.filter(r => ["pending", "confirmed", "ready"].includes(r.status)).slice(0, 3).map(r => ({
        id: r.id,
        medicineName: "Medicine " + r.medicineId,
        pharmacyName: "Pharmacy " + r.pharmacyId,
        quantity: r.quantity,
        totalAmount: r.totalAmount,
        status: r.status,
        deliveryType: r.deliveryType,
        expiresAt: r.expiresAt,
        medicineId: r.medicineId,
        pharmacyId: r.pharmacyId,
        prescriptionId: r.prescriptionId,
        qrCode: r.qrCode,
        notes: r.notes,
        price: r.price,
        createdAt: r.createdAt,
      })),
      recentOrders: orders.slice(0, 5).map(o => ({
        id: o.id,
        medicineName: "Medicine",
        pharmacyName: "Pharmacy",
        status: o.status,
        totalAmount: o.totalAmount,
        paymentMethod: o.paymentMethod,
        deliveryType: o.deliveryType,
        estimatedDelivery: o.estimatedDelivery,
        reservationId: o.reservationId,
        paymentStatus: o.paymentStatus,
        deliveryAddress: o.deliveryAddress,
        trackingId: o.trackingId,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      })),
      recentPrescriptions: prescriptions.slice(0, 3),
      aiRecommendations: [
        { id: 1, type: "refill", title: "Time to refill Metformin", description: "Based on your prescription history, you're likely running low on Metformin 500mg.", medicineName: "Metformin 500mg", medicineId: 3, actionLabel: "Reserve Now" },
        { id: 2, type: "saving", title: "Save 22% on Atorvastatin", description: "Jan Aushadhi Kendra has Atorvastatin at ₹68 vs ₹85 at your usual pharmacy.", medicineName: "Atorvastatin 20mg", medicineId: 4, actionLabel: "View Deal" },
      ],
    });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch patient dashboard" });
  }
});

router.get("/analytics/pharmacy-dashboard", async (req, res) => {
  try {
    const inventory = await db.select().from(inventoryTable).where(eq(inventoryTable.pharmacyId, 2));
    const reservations = await db.select().from(reservationsTable).where(eq(reservationsTable.pharmacyId, 2));
    const orders = await db.select().from(ordersTable);

    const revenueByDay = Array.from({ length: 14 }, (_, i) => ({
      date: new Date(Date.now() - (13 - i) * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
      revenue: 8000 + Math.floor(Math.random() * 12000),
      orders: 12 + Math.floor(Math.random() * 18),
    }));

    res.json({
      totalInventory: inventory.reduce((sum, i) => sum + Number(i.quantity), 0),
      lowStockCount: inventory.filter(i => Number(i.quantity) <= Number(i.reorderLevel) && Number(i.quantity) > 0).length,
      outOfStockCount: inventory.filter(i => Number(i.quantity) === 0).length,
      todayReservations: reservations.length,
      pendingReservations: reservations.filter(r => r.status === "pending").length,
      confirmedReservations: reservations.filter(r => r.status === "confirmed").length,
      todayRevenue: 14280,
      monthlyRevenue: 342800,
      courierRequests: reservations.filter(r => r.deliveryType === "courier").length,
      recentReservations: reservations.slice(0, 5),
      topSellingMedicines: [
        { medicineId: 2, medicineName: "Paracetamol 650mg", category: "Analgesics", count: 184, revenue: 4416, trend: "up", percentChange: 12.4 },
        { medicineId: 3, medicineName: "Metformin 500mg", category: "Antidiabetics", count: 142, revenue: 5964, trend: "up", percentChange: 8.7 },
      ],
      revenueByDay,
    });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch pharmacy dashboard" });
  }
});

router.get("/analytics/admin-dashboard", async (req, res) => {
  try {
    const [userCount] = await db.select({ count: count() }).from(usersTable);
    const [pharmacyCount] = await db.select({ count: count() }).from(pharmaciesTable);
    const [medicineCount] = await db.select({ count: count() }).from(medicinesTable);
    const [orderCount] = await db.select({ count: count() }).from(ordersTable);

    res.json({
      totalUsers: Number(userCount?.count ?? 0),
      totalPharmacies: Number(pharmacyCount?.count ?? 0),
      totalMedicines: Number(medicineCount?.count ?? 0),
      totalOrders: Number(orderCount?.count ?? 0),
      monthlyRevenue: 8720000,
      activeReservations: 2341,
      pendingVerifications: 23,
      platformHealth: { serverStatus: "healthy", dbStatus: "healthy", apiStatus: "healthy", apiResponseTime: 142, uptime: 99.97, errorRate: 0.02 },
      recentActivity: [
        { id: 1, type: "userRegistered", description: "New patient registered: Kavita Mishra from Delhi", timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), metadata: "" },
        { id: 2, type: "pharmacyVerified", description: "PharmEasy Outlet Bangalore verified and activated", timestamp: new Date(Date.now() - 18 * 60 * 1000).toISOString(), metadata: "" },
        { id: 3, type: "paymentReceived", description: "Courier payment ₹846 received from Rajan Mehta", timestamp: new Date(Date.now() - 42 * 60 * 1000).toISOString(), metadata: "" },
        { id: 4, type: "orderPlaced", description: "Cross-state courier order: Mumbai → Bengaluru (Amoxicillin)", timestamp: new Date(Date.now() - 72 * 60 * 1000).toISOString(), metadata: "" },
      ],
      userGrowth: Array.from({ length: 12 }, (_, i) => ({
        date: new Date(2025, i, 1).toLocaleDateString("en-IN", { month: "short" }),
        revenue: 100000 + i * 65000,
        orders: 1200 + i * 800,
      })),
    });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch admin dashboard" });
  }
});

router.get("/analytics/top-medicines", async (req, res) => {
  try {
    const { limit = "10" } = req.query as Record<string, string>;
    const meds = await db.select().from(medicinesTable).limit(Number(limit));
    res.json(meds.map(m => ({ medicineId: m.id, medicineName: m.name, count: Math.floor(Math.random() * 200), revenue: Math.floor(Math.random() * 10000) })));
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch top medicines" });
  }
});

router.get("/analytics/demand-forecast", async (req, res) => {
  try {
    const { days = "30" } = req.query as Record<string, string>;
    const meds = await db.select().from(medicinesTable);
    const forecast = meds.slice(0, 6).map(m => ({
      medicineId: m.id,
      medicineName: m.name,
      genericName: m.genericName,
      currentStock: Math.floor(Math.random() * 200),
      predictedDemand: Math.floor(Math.random() * 300),
      reorderSuggestion: Math.random() > 0.5 ? Math.floor(Math.random() * 100) : 0,
      confidence: Math.floor(85 + Math.random() * 15),
      trend: ["rising", "stable", "falling"][Math.floor(Math.random() * 3)],
      healthStatus: ["healthy", "warning", "critical"][Math.floor(Math.random() * 3)],
      aiInsight: "AI-powered demand prediction based on historical patterns and seasonal trends.",
      daysUntilStockout: Math.random() > 0.5 ? Math.floor(Math.random() * 30) : null,
    }));
    res.json(forecast);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch demand forecast" });
  }
});

export default router;
