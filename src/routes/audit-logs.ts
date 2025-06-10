import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { RequestHandler } from "express";
import { getAuditLogs } from "../controllers/audit-logs";

const router = Router();

router.use(authenticate as RequestHandler);

router.get("/", authorize(["admin", "viewer", "uploader"]) as RequestHandler, getAuditLogs as unknown as RequestHandler);

export default router; 