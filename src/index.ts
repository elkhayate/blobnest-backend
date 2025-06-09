import dotenv from "dotenv";
dotenv.config();
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import usersRoutes from "./routes/users";
import { setupMiddleware } from "./middleware";
import logger from "./config/logger";
import containersRoutes from "./routes/containers";
import filesRoutes from "./routes/files";

const app = express();
const PORT = process.env.PORT || 3000;

setupMiddleware(app);
app.use(cors());

app.use("/api/users", usersRoutes);
app.use("/api/containers", containersRoutes);
app.use("/api/files", filesRoutes);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error("Unhandled error:", { 
    error: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined
  });
  
  res.status(500).json({ 
    status: "error",
    message: "Internal server error"
  });
});

app.listen(PORT, () => {
  logger.info(`🚀 Server running in ${process.env.NODE_ENV || "development"} mode on http://localhost:${PORT}`);
});
