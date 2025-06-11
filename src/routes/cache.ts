import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { RequestHandler } from "express";
import { invalidateCache } from "../config/redis";
import logger from "../config/logger";

const router = Router();

router.use(authenticate as RequestHandler);

router.delete("/clear-all", 
    authorize(["admin"]) as RequestHandler,
    (async (req: Request, res: Response) => {
        try {
            await invalidateCache.clearAll();
            logger.info('🧹 Manual cache clear requested by admin');
            res.json({ 
                status: "success", 
                message: "All cache cleared successfully" 
            });
        } catch (error) {
            logger.error('❌ Manual cache clear failed:', error);
            res.status(500).json({ 
                status: "error", 
                message: "Failed to clear cache" 
            });
        }
    }) as unknown as RequestHandler
);

router.delete("/clear/:type", 
    authorize(["admin"]) as RequestHandler,
    (async (req: Request, res: Response) => {
        try {
            const { type } = req.params;
            const { containerName } = req.query;

            switch (type) {
                case 'users':
                    await invalidateCache.users();
                    break;
                case 'containers':
                    await invalidateCache.containers();
                    break;
                case 'files':
                    await invalidateCache.files(containerName as string);
                    break;
                case 'dashboard':
                    await invalidateCache.dashboard();
                    break;
                case 'audit-logs':
                    await invalidateCache.auditLogs();
                    break;
                default:
                    res.status(400).json({ 
                        status: "error", 
                        message: "Invalid cache type. Use: users, containers, files, dashboard, or audit-logs" 
                    });
                    return;
            }

            logger.info(`🗑️ Manual cache clear requested for: ${type}`);
            res.json({ 
                status: "success", 
                message: `${type} cache cleared successfully` 
            });
        } catch (error) {
            logger.error(`❌ Manual cache clear failed for ${req.params.type}:`, error);
            res.status(500).json({ 
                status: "error", 
                message: "Failed to clear cache" 
            });
        }
    }) as unknown as RequestHandler
);

export default router; 