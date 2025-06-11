import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import logger from '../config/logger';

const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

export const setupMiddleware = (app: express.Application) => {
  app.use(helmet());

  app.use(compression());

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,  
    max: 100,  
    message: 'Too many requests from this IP, please try again later.',
  });
  app.use(limiter);

  app.use(morgan('combined', { stream: morganStream }));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
}; 