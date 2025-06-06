import { Response, NextFunction } from "express";
import { supabase } from "../services/supabase";
import { UserRequest } from "../types";

export async function authenticate(req: UserRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Missing token" });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: "Unauthorized" });

  req.user = data.user;
  next();
}

export default authenticate;
