import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { RequestHandler } from "express";
import multer from "multer";
import { 
    getFiles, 
    uploadFile, 
    updateFile, 
    deleteFile, 
    getAllFiles,
} from "../controllers/files";
import { cache, generateUserCacheKey, generateCacheKeyWithQuery } from "../middleware/cache";
import { cacheKeys } from "../config/redis";
import { invalidateCacheAfter } from "../middleware/invalidateCache";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticate as RequestHandler);

 
 

router.get("/:containerName", 
  authorize(["admin", "viewer", "uploader"]) as RequestHandler, 
  cache((req) => cacheKeys.files.byContainer(req.params.containerName), { ttl: 300, category: 'files' }) as RequestHandler,
  getFiles as unknown as RequestHandler
);

router.post("/", 
    authorize(["admin", "uploader"]) as RequestHandler,
    upload.single("file"),
    invalidateCacheAfter('files') as RequestHandler,
    uploadFile as unknown as RequestHandler
);

router.put("/:containerName/:fileName", 
  authorize(["admin", "uploader"]) as RequestHandler,
  invalidateCacheAfter('files') as RequestHandler,
  updateFile as unknown as RequestHandler
);

router.delete("/:containerName/:fileName", 
  authorize(["admin", "uploader"]) as RequestHandler,
  invalidateCacheAfter('files') as RequestHandler,
  deleteFile as unknown as RequestHandler
);

router.get("/", 
  authorize(["admin", "viewer", "uploader"]) as RequestHandler, 
  cache(generateUserCacheKey('files:all'), { ttl: 300, category: 'files' }) as RequestHandler,
  getAllFiles as unknown as RequestHandler
);

export default router; 