import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { RequestHandler } from "express";
import { getAuditLogs } from "../controllers/audit-logs";
import { cache, generateCacheKeyWithQuery } from "../middleware/cache";

const router = Router();

router.use(authenticate as RequestHandler);

router.get("/", 
  authorize(["admin", "viewer", "uploader"]) as RequestHandler, 
  cache(generateCacheKeyWithQuery('audit-logs:all'), { ttl: 300, category: 'auditLogs' }) as RequestHandler,
  getAuditLogs as unknown as RequestHandler
);

export default router; 