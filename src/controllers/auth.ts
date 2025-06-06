import { Request, Response, RequestHandler } from 'express';
import logger from '../config/logger';
import { validateSignup } from '../validations/auth';

const signupHandler: RequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = validateSignup(req.body);
    
    if (!validationResult.success) {
      logger.warn('Signup validation failed', { errors: validationResult.error.format() });
      res.status(400).json({ errors: validationResult.error.format() });
      return;
    }

    const { email, password, displayName, companyName, companyId } = validationResult.data;
    
    logger.info('New signup attempt', {
      email,
      displayName,
      companyName,
      companyId
    });

    
    res.status(201).json({
      message: 'User created successfully',
      user: { email, displayName, companyName, companyId }
    });
  } catch (error) {
    logger.error('Signup error', { error });
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const signup = signupHandler;