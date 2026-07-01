import { Router } from "express";
import { db } from "@workspace/db";
import { prescriptionsTable, parsedMedicinesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const DEMO_USER_ID = 1;

router.get("/prescriptions", async (req, res) => {
  try {
    const list = await db.select().from(prescriptionsTable).where(eq(prescriptionsTable.userId, DEMO_USER_ID));
    res.json(list);
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch prescriptions" });
  }
});

router.get("/prescriptions/:id", async (req, res) => {
  try {
    const [rx] = await db.select().from(prescriptionsTable).where(eq(prescriptionsTable.id, Number(req.params.id)));
    if (!rx) return res.status(404).json({ error: "Prescription not found" });
    const medicines = await db.select().from(parsedMedicinesTable).where(eq(parsedMedicinesTable.prescriptionId, rx.id));
    res.json({ ...rx, medicines });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch prescription" });
  }
});

router.post("/prescriptions/upload", async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    await new Promise(r => setTimeout(r, 500));
    const [rx] = await db.insert(prescriptionsTable).values({
      userId: DEMO_USER_ID,
      doctorName: "Dr. Ananya Sharma",
      patientName: "Arjun Mehta",
      hospitalName: "Apollo Hospitals, Mumbai",
      status: "parsed",
      overallConfidence: "94.2",
      notes: "AI parsed prescription",
    }).returning();

    const parsedMeds = [
      { prescriptionId: rx.id, name: "Metformin 500mg", dosage: "500mg", frequency: "Twice daily", duration: "3 months", confidence: "97", status: "confirmed" },
      { prescriptionId: rx.id, name: "Atorvastatin 20mg", dosage: "20mg", frequency: "Once daily", duration: "3 months", confidence: "92", status: "confirmed" },
      { prescriptionId: rx.id, name: "Pantoprazole 40mg", dosage: "40mg", frequency: "Once daily", duration: "1 month", confidence: "88", status: "confirmed" },
    ];
    await db.insert(parsedMedicinesTable).values(parsedMeds);
    const medicines = await db.select().from(parsedMedicinesTable).where(eq(parsedMedicinesTable.prescriptionId, rx.id));
    res.json({ ...rx, medicines });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to upload prescription" });
  }
});

export default router;
