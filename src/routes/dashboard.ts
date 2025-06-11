import { Router } from "express";
import { getDashboardStats, getStorageMetrics, getContainerMetrics } from "../controllers/dashboard";
import authenticate from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { RequestHandler } from "express";
import { cache, generateCacheKeyWithQuery } from "../middleware/cache";

const router = Router();

router.use(authenticate as RequestHandler);

router.get(
    "/stats",
    authorize(["admin", "viewer"]) as RequestHandler,
    cache(generateCacheKeyWithQuery('dashboard:stats'), { ttl: 600, category: 'dashboard' }) as RequestHandler,
    getDashboardStats as unknown as RequestHandler
);

router.get(
    "/storage/metrics",
    authorize(["admin", "viewer"]) as RequestHandler,
    cache(generateCacheKeyWithQuery('dashboard:storage'), { ttl: 600, category: 'dashboard' }) as RequestHandler,
    getStorageMetrics as unknown as RequestHandler
);

router.get(
    "/container/metrics",
    authorize(["admin", "viewer"]) as RequestHandler,
    cache(generateCacheKeyWithQuery('dashboard:container'), { ttl: 600, category: 'dashboard' }) as RequestHandler,
    getContainerMetrics as unknown as RequestHandler
);

export default router; 