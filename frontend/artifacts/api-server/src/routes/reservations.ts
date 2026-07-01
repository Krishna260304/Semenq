import { Router } from "express";
import { db } from "@workspace/db";
import { reservationsTable, medicinesTable, pharmaciesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

const DEMO_USER_ID = 1;

router.get("/reservations", async (req, res) => {
  try {
    const { status, pharmacyId } = req.query as Record<string, string>;
    const list = await db.select({
      id: reservationsTable.id,
      userId: reservationsTable.userId,
      medicineId: reservationsTable.medicineId,
      pharmacyId: reservationsTable.pharmacyId,
      medicineName: medicinesTable.name,
      pharmacyName: pharmaciesTable.name,
      quantity: reservationsTable.quantity,
      price: reservationsTable.price,
      totalAmount: reservationsTable.totalAmount,
      status: reservationsTable.status,
      deliveryType: reservationsTable.deliveryType,
      expiresAt: reservationsTable.expiresAt,
      prescriptionId: reservationsTable.prescriptionId,
      qrCode: reservationsTable.qrCode,
      notes: reservationsTable.notes,
      createdAt: reservationsTable.createdAt,
    })
      .from(reservationsTable)
      .innerJoin(medicinesTable, eq(reservationsTable.medicineId, medicinesTable.id))
      .innerJoin(pharmaciesTable, eq(reservationsTable.pharmacyId, pharmaciesTable.id));

    let filtered = list;
    if (status) filtered = filtered.filter(r => r.status === status);
    if (pharmacyId) filtered = filtered.filter(r => r.pharmacyId === Number(pharmacyId));
    res.json(filtered);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch reservations" });
  }
});

router.get("/reservations/:id", async (req, res) => {
  try {
    const [r] = await db.select().from(reservationsTable).where(eq(reservationsTable.id, Number(req.params.id)));
    if (!r) return res.status(404).json({ error: "Reservation not found" });
    res.json(r);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch reservation" });
  }
});

router.post("/reservations", async (req, res) => {
  try {
    const { medicineId, pharmacyId, quantity = 1, deliveryType = "pickup", prescriptionId, notes } = req.body;
    const [med] = await db.select().from(medicinesTable).where(eq(medicinesTable.id, Number(medicineId)));
    if (!med) return res.status(404).json({ error: "Medicine not found" });
    const price = Number(med.price);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const qrCode = `QR${Date.now()}`;
    const [reservation] = await db.insert(reservationsTable).values({
      userId: DEMO_USER_ID,
      medicineId: Number(medicineId),
      pharmacyId: Number(pharmacyId),
      quantity: Number(quantity),
      price: String(price),
      totalAmount: String(price * Number(quantity)),
      status: "pending",
      deliveryType,
      expiresAt,
      qrCode,
      prescriptionId: prescriptionId ? Number(prescriptionId) : undefined,
      notes,
    }).returning();
    res.status(201).json(reservation);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to create reservation" });
  }
});

router.patch("/reservations/:id", async (req, res) => {
  try {
    const { status, notes } = req.body;
    const [updated] = await db.update(reservationsTable).set({ status: status ?? undefined, notes: notes ?? undefined, updatedAt: new Date() }).where(eq(reservationsTable.id, Number(req.params.id))).returning();
    if (!updated) return res.status(404).json({ error: "Reservation not found" });
    res.json(updated);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to update reservation" });
  }
});

export default router;
