import dotenv from "dotenv";
dotenv.config();
import express, { Request, Response } from "express";
import cors from "cors";
import usersRoutes from "./routes/users";
import { setupMiddleware } from "./middleware";
import logger from "./config/logger";
import "./config/redis";
import containersRoutes from "./routes/containers";
import filesRoutes from "./routes/files";
import auditLogsRoutes from "./routes/audit-logs";
import dashboardRoutes from "./routes/dashboard";
import cacheRoutes from "./routes/cache";
import { testRedisConnection } from "./utils/test-redis";

const app = express();
const PORT = process.env.PORT || 3000;

setupMiddleware(app);
app.use(cors({
  origin: ['https://blobnest-frontend.vercel.app', 'http://localhost:5173']
}));

app.use("/api/users", usersRoutes);
app.use("/api/containers", containersRoutes);
app.use("/api/files", filesRoutes);
app.use("/api/audit-logs", auditLogsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/cache", cacheRoutes);

app.use((err: Error, req: Request, res: Response) => {
  logger.error("Unhandled error:", { 
    error: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined
  });
  
  res.status(500).json({ 
    status: "error",
    message: "Internal server error"
  });
});

app.listen(PORT, async () => {
  logger.info(`🚀 Server running in ${process.env.NODE_ENV || "development"} mode on http://localhost:${PORT}`);
  
  await testRedisConnection();
});
