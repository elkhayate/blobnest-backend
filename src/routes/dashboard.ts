import { Router } from "express";
import { getDashboardStats, getStorageMetrics, getContainerMetrics } from "../controllers/dashboard";
import authenticate from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { RequestHandler } from "express";

const router = Router();

router.use(authenticate as RequestHandler);

router.get(
    "/stats",
    authorize(["admin", "viewer"]) as RequestHandler,
    getDashboardStats as unknown as RequestHandler
);

router.get(
    "/storage/metrics",
    authorize(["admin", "viewer"]) as RequestHandler,
    getStorageMetrics as unknown as RequestHandler
);

router.get(
    "/container/metrics",
    authorize(["admin", "viewer"]) as RequestHandler,
    getContainerMetrics as unknown as RequestHandler
);

export default router; 