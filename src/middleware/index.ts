import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import logger from '../config/logger';

// Create a custom stream for Morgan to use Winston
const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

export const setupMiddleware = (app: express.Application) => {
  // Security headers
  app.use(helmet());

  // Compression
  app.use(compression());

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
  });
  app.use(limiter);

  // HTTP request logging
  app.use(morgan('combined', { stream: morganStream }));

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
}; 