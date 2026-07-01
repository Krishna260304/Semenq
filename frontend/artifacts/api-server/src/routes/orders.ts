import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, reservationsTable, medicinesTable, pharmaciesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const DEMO_USER_ID = 1;

router.get("/orders", async (req, res) => {
  try {
    const { status } = req.query as Record<string, string>;
    const list = await db.select({
      id: ordersTable.id,
      userId: ordersTable.userId,
      reservationId: ordersTable.reservationId,
      medicineName: medicinesTable.name,
      pharmacyName: pharmaciesTable.name,
      status: ordersTable.status,
      deliveryType: ordersTable.deliveryType,
      totalAmount: ordersTable.totalAmount,
      paymentMethod: ordersTable.paymentMethod,
      paymentStatus: ordersTable.paymentStatus,
      deliveryAddress: ordersTable.deliveryAddress,
      trackingId: ordersTable.trackingId,
      estimatedDelivery: ordersTable.estimatedDelivery,
      createdAt: ordersTable.createdAt,
      updatedAt: ordersTable.updatedAt,
    })
      .from(ordersTable)
      .innerJoin(reservationsTable, eq(ordersTable.reservationId, reservationsTable.id))
      .innerJoin(medicinesTable, eq(reservationsTable.medicineId, medicinesTable.id))
      .innerJoin(pharmaciesTable, eq(reservationsTable.pharmacyId, pharmaciesTable.id))
      .where(eq(ordersTable.userId, DEMO_USER_ID));

    let filtered = list;
    if (status) filtered = filtered.filter(o => o.status === status);
    res.json(filtered);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

router.get("/orders/:id", async (req, res) => {
  try {
    const [o] = await db.select().from(ordersTable).where(eq(ordersTable.id, Number(req.params.id)));
    if (!o) return res.status(404).json({ error: "Order not found" });
    res.json(o);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

router.get("/orders/:id/tracking", async (req, res) => {
  try {
    const [o] = await db.select().from(ordersTable).where(eq(ordersTable.id, Number(req.params.id)));
    if (!o) return res.status(404).json({ error: "Order not found" });
    const stages = ["placed", "processing", "packed", "shipped", "delivered"];
    const currentIdx = stages.indexOf(o.status);
    const timeline = stages.map((stage, i) => ({
      stage,
      label: stage === "placed" ? "Order Placed" : stage === "processing" ? "Processing" : stage === "packed" ? "Packed & Ready" : stage === "shipped" ? "Out for Delivery" : "Delivered",
      description: stage === "placed" ? "Your order was placed and payment confirmed" : stage === "processing" ? "Pharmacy is preparing your order" : stage === "packed" ? "Your medicines are packed and sealed" : stage === "shipped" ? "Order dispatched via courier" : "Package delivered to your address",
      timestamp: i <= currentIdx ? new Date(Date.now() - (currentIdx - i) * 6 * 60 * 60 * 1000).toISOString() : null,
      completed: i <= currentIdx,
    }));
    res.json({ orderId: o.id, currentStatus: o.status, estimatedDelivery: o.estimatedDelivery, timeline });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch tracking" });
  }
});

router.post("/orders", async (req, res) => {
  try {
    const { reservationId, paymentMethod = "upi", deliveryAddress } = req.body;
    const [res_] = await db.select().from(reservationsTable).where(eq(reservationsTable.id, Number(reservationId)));
    if (!res_) return res.status(404).json({ error: "Reservation not found" });
    const trackingId = `SQ${Date.now()}`;
    const [order] = await db.insert(ordersTable).values({
      userId: DEMO_USER_ID,
      reservationId: Number(reservationId),
      status: "placed",
      deliveryType: res_.deliveryType,
      totalAmount: res_.totalAmount ?? "0",
      paymentMethod,
      paymentStatus: "paid",
      deliveryAddress,
      trackingId,
      estimatedDelivery: res_.deliveryType === "courier" ? "2-3 business days" : "Ready for pickup",
    }).returning();
    await db.update(reservationsTable).set({ status: "confirmed" }).where(eq(reservationsTable.id, Number(reservationId)));
    res.status(201).json(order);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to create order" });
  }
});

export default router;
