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

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticate as RequestHandler);

 
 

router.get("/:containerName", authorize(["admin", "viewer", "uploader"]) as RequestHandler, getFiles as unknown as RequestHandler);

router.post("/", 
    authorize(["admin", "uploader"]) as RequestHandler,
    upload.single("file"),
    uploadFile as unknown as RequestHandler
);

router.put("/:containerName/:fileName", authorize(["admin", "uploader"]) as RequestHandler, updateFile as unknown as RequestHandler);

router.delete("/:containerName/:fileName", authorize(["admin", "uploader"]) as RequestHandler, deleteFile as unknown as RequestHandler);

router.get("/", authorize(["admin", "viewer", "uploader"]) as RequestHandler, getAllFiles as unknown as RequestHandler);

export default router; 