import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { RequestHandler } from "express";
import { getContainers, createContainer, updateContainer, deleteContainer } from "../controllers/containers";

const router = Router();

router.use(authenticate as RequestHandler);

router.get("/", authorize(["admin", "viewer", "uploader"]) as RequestHandler, getContainers as unknown as RequestHandler);
router.post("/", authorize(["admin"]) as RequestHandler, createContainer as unknown as RequestHandler);
router.put("/:containerName", authorize(["admin"]) as RequestHandler, updateContainer as unknown as RequestHandler);
router.delete("/:containerName", authorize(["admin"]) as RequestHandler, deleteContainer as unknown as RequestHandler);

export default router;
