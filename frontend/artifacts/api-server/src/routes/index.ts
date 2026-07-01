import { Router, type IRouter } from "express";
import healthRouter from "./health";
import medicinesRouter from "./medicines";
import pharmaciesRouter from "./pharmacies";
import searchRouter from "./search";
import prescriptionsRouter from "./prescriptions";
import reservationsRouter from "./reservations";
import ordersRouter from "./orders";
import usersRouter from "./users";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(medicinesRouter);
router.use(pharmaciesRouter);
router.use(searchRouter);
router.use(prescriptionsRouter);
router.use(reservationsRouter);
router.use(ordersRouter);
router.use(usersRouter);
router.use(dashboardRouter);

export default router;
