import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, notificationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const DEMO_USER_ID = 1;

router.get("/users/me", async (req, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, DEMO_USER_ID));
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(user);
  } catch (e) {
    req.log.error(e);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.patch("/users/me", async (req, res) => {
  try {
    const { name, phone, city, state, pincode, address } = req.body;
    const [updated] = await db.update(usersTable).set({
      name: name ?? undefined,
      phone: phone ?? undefined,
      city: city ?? undefined,
      state: state ?? undefined,
      pincode: pincode ?? undefined,
      address: address ?? undefined,
    }).where(eq(usersTable.id, DEMO_USER_ID)).returning();
    return res.json(updated);
  } catch (e) {
    req.log.error(e);
    return res.status(500).json({ error: "Failed to update profile" });
  }
});

router.get("/users", async (req, res) => {
  try {
    const users = await db.select().from(usersTable);
    return res.json(users);
  } catch (e) {
    req.log.error(e);
    return res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.get("/notifications", async (req, res) => {
  try {
    const { unreadOnly } = req.query as Record<string, string>;
    let notifications = await db.select().from(notificationsTable).where(eq(notificationsTable.userId, DEMO_USER_ID));
    if (unreadOnly === "true") notifications = notifications.filter(n => !n.isRead);
    return res.json(notifications);
  } catch (e) {
    req.log.error(e);
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

router.patch("/notifications/:id/read", async (req, res) => {
  try {
    await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.id, Number(req.params.id)));
    return res.json({ success: true });
  } catch (e) {
    req.log.error(e);
    return res.status(500).json({ error: "Failed to mark notification" });
  }
});

export default router;
