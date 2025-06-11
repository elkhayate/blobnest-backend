import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { RequestHandler } from "express";
import { getContainers, createContainer, updateContainer, deleteContainer } from "../controllers/containers";
import { cache, generateUserCacheKey } from "../middleware/cache";
import { invalidateCacheAfter } from "../middleware/invalidateCache";

const router = Router();

router.use(authenticate as RequestHandler);

router.get("/", 
  authorize(["admin", "viewer", "uploader"]) as RequestHandler, 
  cache(generateUserCacheKey('containers'), { ttl: 300, category: 'containers' }) as RequestHandler,
  getContainers as unknown as RequestHandler
);

router.post("/", 
  authorize(["admin", "uploader"]) as RequestHandler, 
  invalidateCacheAfter('containers') as RequestHandler,
  createContainer as unknown as RequestHandler
);

router.put("/:containerName", 
  authorize(["admin", "uploader"]) as RequestHandler, 
  invalidateCacheAfter('containers') as RequestHandler,
  updateContainer as unknown as RequestHandler
);

router.delete("/:containerName", 
  authorize(["admin", "uploader"]) as RequestHandler, 
  invalidateCacheAfter('containers') as RequestHandler,
  deleteContainer as unknown as RequestHandler
);

export default router;
