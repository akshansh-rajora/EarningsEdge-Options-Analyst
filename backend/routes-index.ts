import { Router, type IRouter } from "express";
import healthRouter from "./health-route";
import analyseRouter from "./analyse-route";

const router: IRouter = Router();

router.use(healthRouter);
router.use(analyseRouter);

export default router;
