import { Router } from "express";
import { getUsers, createUser, updateUser, deleteUser, getUserAndCompanyInfo, updateUserInfo, updateCompanyInfo } from "../controllers/users";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { RequestHandler } from "express";

const router = Router();

router.use(authenticate as RequestHandler);

router.get("/", authorize(["admin"]) as RequestHandler, getUsers as unknown as RequestHandler);

router.get("/user-and-company-info", authorize(["admin", "viewer", "uploader"]) as RequestHandler, getUserAndCompanyInfo as unknown as RequestHandler);

router.put("/settings", authorize(["admin", "viewer", "uploader"]) as RequestHandler, updateUserInfo as unknown as RequestHandler);

router.put("/company-settings", authorize(["admin"]) as RequestHandler, updateCompanyInfo as unknown as RequestHandler);


router.post("/", authorize(["admin"]) as RequestHandler, createUser as unknown as RequestHandler);

router.put("/:userId", authorize(["admin"]) as RequestHandler, updateUser as unknown as RequestHandler);

router.delete("/:userId", authorize(["admin"]) as RequestHandler, deleteUser as unknown as RequestHandler);

export default router;
