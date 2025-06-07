import { Router } from "express";
import { getUsers, createUser, updateUser, deleteUser } from "../controllers/users";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { RequestHandler } from "express";

const router = Router();

router.use(authenticate as RequestHandler);

router.get("/", authorize(["admin"]) as RequestHandler, getUsers as unknown as RequestHandler);

router.post("/", authorize(["admin"]) as RequestHandler, createUser as unknown as RequestHandler);

router.put("/:userId", authorize(["admin"]) as RequestHandler, updateUser as unknown as RequestHandler);

router.delete("/:userId", authorize(["admin"]) as RequestHandler, deleteUser as unknown as RequestHandler);

export default router;
