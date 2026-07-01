import { Router } from "express";
import { db } from "@workspace/db";
import { pharmaciesTable, inventoryTable, medicinesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/pharmacies", async (req, res) => {
  try {
    const { city, state } = req.query as Record<string, string>;
    let list = await db.select().from(pharmaciesTable);
    if (city) list = list.filter(p => p.city.toLowerCase().includes(city.toLowerCase()));
    if (state) list = list.filter(p => p.state.toLowerCase().includes(state.toLowerCase()));
    res.json(list);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch pharmacies" });
  }
});

router.get("/pharmacies/:id", async (req, res) => {
  try {
    const [ph] = await db.select().from(pharmaciesTable).where(eq(pharmaciesTable.id, Number(req.params.id)));
    if (!ph) return res.status(404).json({ error: "Pharmacy not found" });
    res.json(ph);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch pharmacy" });
  }
});

router.get("/pharmacies/:id/inventory", async (req, res) => {
  try {
    const items = await db
      .select({ id: inventoryTable.id, pharmacyId: inventoryTable.pharmacyId, medicineId: inventoryTable.medicineId, medicineName: medicinesTable.name, genericName: medicinesTable.genericName, quantity: inventoryTable.quantity, price: inventoryTable.price, mrp: inventoryTable.mrp, expiryDate: inventoryTable.expiryDate, batchNumber: inventoryTable.batchNumber, reorderLevel: inventoryTable.reorderLevel, lastRestocked: inventoryTable.lastRestocked })
      .from(inventoryTable)
      .innerJoin(medicinesTable, eq(inventoryTable.medicineId, medicinesTable.id))
      .where(eq(inventoryTable.pharmacyId, Number(req.params.id)));
    const withStatus = items.map(item => ({
      ...item,
      stockStatus: Number(item.quantity) === 0 ? "outOfStock" : Number(item.quantity) <= Number(item.reorderLevel) ? "lowStock" : "inStock",
    }));
    res.json(withStatus);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch inventory" });
  }
});

router.put("/pharmacies/:id/inventory/:itemId", async (req, res) => {
  try {
    const { quantity, price, mrp } = req.body;
    await db.update(inventoryTable).set({ quantity: quantity ?? undefined, price: price ?? undefined, mrp: mrp ?? undefined, updatedAt: new Date() }).where(eq(inventoryTable.id, Number(req.params.itemId)));
    res.json({ success: true });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to update inventory" });
  }
});

export default router;
