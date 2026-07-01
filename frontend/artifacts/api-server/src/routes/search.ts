import { Router } from "express";
import { db } from "@workspace/db";
import { medicinesTable, pharmaciesTable, inventoryTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/search/medicines", async (req, res) => {
  try {
    const { q, sortBy = "bestMatch" } = req.query as Record<string, string>;
    if (!q) return res.json({ results: [], total: 0 });

    const meds = await db.select().from(medicinesTable);
    const matched = meds.filter(m =>
      m.name.toLowerCase().includes(q.toLowerCase()) ||
      m.genericName.toLowerCase().includes(q.toLowerCase()) ||
      (m.composition && m.composition.toLowerCase().includes(q.toLowerCase()))
    );

    const pharmacies = await db.select().from(pharmaciesTable);

    const results = [];
    for (const med of matched.slice(0, 10)) {
      for (const ph of pharmacies.slice(0, 3)) {
        const [inv] = await db.select().from(inventoryTable).where(eq(inventoryTable.medicineId, med.id));
        results.push({
          medicine: med,
          pharmacy: ph,
          price: inv ? Number(inv.price) : Number(med.price),
          quantity: inv ? Number(inv.quantity) : Math.floor(Math.random() * 100),
          distance: Math.round(Math.random() * 50 * 10) / 10,
          distanceUnit: "km",
          estimatedDelivery: Math.random() > 0.5 ? `${Math.floor(Math.random() * 60 + 20)} min` : `${Math.floor(Math.random() * 3 + 1)}-${Math.floor(Math.random() * 2 + 2)} days`,
          deliveryType: ph.offersCourier && Math.random() > 0.5 ? "courier" : "pickup",
          stockStatus: inv && Number(inv.quantity) > 0 ? (Number(inv.quantity) <= 10 ? "limited" : "available") : "outOfStock",
          matchScore: 0.95 - results.length * 0.03,
        });
      }
    }

    return res.json({ results: results.slice(0, 20), total: results.length, searchRadius: "city" });
  } catch (e) {
    req.log.error(e);
    return res.status(500).json({ error: "Search failed" });
  }
});

router.get("/search/suggestions", async (req, res) => {
  try {
    const { q } = req.query as Record<string, string>;
    if (!q || q.length < 2) return res.json([]);
    const meds = await db.select({ name: medicinesTable.name, genericName: medicinesTable.genericName }).from(medicinesTable);
    const suggestions = meds
      .filter(m => m.name.toLowerCase().includes(q.toLowerCase()) || m.genericName.toLowerCase().includes(q.toLowerCase()))
      .map(m => m.name)
      .slice(0, 8);
    return res.json(suggestions);
  } catch (e) {
    req.log.error(e);
    return res.status(500).json({ error: "Suggestions failed" });
  }
});

export default router;
