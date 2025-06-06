import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import { setupMiddleware } from "./middleware";
import logger from "./config/logger";

const app = express();

// Setup all middleware
setupMiddleware(app);

// CORS configuration
app.use(cors());

// Routes
app.use("/api/auth", authRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', { error: err });
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
});
