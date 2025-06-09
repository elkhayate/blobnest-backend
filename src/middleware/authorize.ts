import { Response, NextFunction } from "express";
import { UserRequest } from "../types";
import { supabaseAdmin } from "../services/supabase";
import { User } from "@supabase/supabase-js";

type Role = "admin" | "viewer" | "uploader";

export const authorize = (allowedRoles: Role[]) => {
  return async (req: UserRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(req.user.id);

      if (error) {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (!user) {
        return res.status(403).json({ error: "User not found" });
      }

      const userRole = user.user_metadata?.role as Role;
      
      if (!userRole || !allowedRoles.includes(userRole)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      req.user = user as User;
      next();
    } catch (error) {
      console.error("Authorization error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}; 