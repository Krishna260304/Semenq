import { Router } from "express";
import { db } from "@workspace/db";
import { medicinesTable } from "@workspace/db";
import { eq, ilike, or } from "drizzle-orm";

const router = Router();

router.get("/medicines", async (req, res) => {
  try {
    const { query, category, page = "1", limit = "20" } = req.query as Record<string, string>;
    let medicines = await db.select().from(medicinesTable);
    if (query) medicines = medicines.filter(m => m.name.toLowerCase().includes(query.toLowerCase()) || m.genericName.toLowerCase().includes(query.toLowerCase()));
    if (category) medicines = medicines.filter(m => m.category === category);
    const offset = (Number(page) - 1) * Number(limit);
    return res.json({ medicines: medicines.slice(offset, offset + Number(limit)), total: medicines.length, page: Number(page) });
  } catch (e) {
    req.log.error(e);
    return res.status(500).json({ error: "Failed to fetch medicines" });
  }
});

router.get("/medicines/:id", async (req, res) => {
  try {
    const [med] = await db.select().from(medicinesTable).where(eq(medicinesTable.id, Number(req.params.id)));
    if (!med) return res.status(404).json({ error: "Medicine not found" });
    return res.json(med);
  } catch (e) {
    req.log.error(e);
    return res.status(500).json({ error: "Failed to fetch medicine" });
  }
});

router.get("/medicines/:id/availability", async (req, res) => {
  try {
    const med = await db.select().from(medicinesTable).where(eq(medicinesTable.id, Number(req.params.id)));
    if (!med.length) return res.status(404).json({ error: "Medicine not found" });
    return res.json({
      medicineId: Number(req.params.id),
      nearbyPharmacies: 3,
      cityPharmacies: 8,
      statePharmacies: 24,
      nationalPharmacies: 142,
      lowestPrice: 38,
      fastestDelivery: "20 min",
    });
  } catch (e) {
    req.log.error(e);
    return res.status(500).json({ error: "Failed to fetch availability" });
  }
});

export default router;
