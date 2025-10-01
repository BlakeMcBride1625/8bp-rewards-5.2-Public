import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/LoggerService';

export const authenticateAdmin = (req: Request, res: Response, next: NextFunction): void => {
  // Development bypass - auto-authenticate as admin in development mode
  if (process.env.NODE_ENV === 'development') {
    const allowedAdmins = process.env.ALLOWED_ADMINS?.split(',') || [];
    const devAdminId = allowedAdmins[0] || '850726663289700373';
    
    // Attach a mock admin user to the request
    (req as any).user = {
      id: devAdminId,
      username: 'epildev',
      discriminator: '0000',
      avatar: 'dev-avatar'
    };
    
    logger.info('Admin access granted (development mode)', {
      action: 'admin_access_dev',
      userId: devAdminId
    });
    
    return next();
  }
  
  if (req.isAuthenticated && req.isAuthenticated()) {
    const user = req.user as any;
    const allowedAdmins = process.env.ALLOWED_ADMINS?.split(',') || [];
    
    if (allowedAdmins.includes(user.id)) {
      logger.info('Admin access granted', {
        action: 'admin_access',
        userId: user.id,
        username: user.username
      });
      next();
    } else {
      logger.warn('Unauthorized admin access attempt', {
        action: 'admin_access_denied',
        userId: user.id,
        username: user.username,
        ip: req.ip
      });
      res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }
  } else {
    logger.warn('Unauthenticated admin access attempt', {
      action: 'admin_access_unauthenticated',
      ip: req.ip
    });
    res.status(401).json({ error: 'Authentication required' });
  }
};

export const validateRegistration = (req: Request, res: Response, next: NextFunction): void => {
  const { eightBallPoolId, username } = req.body;

  if (!eightBallPoolId || !username) {
    res.status(400).json({ 
      error: 'Missing required fields',
      required: ['eightBallPoolId', 'username']
    });
    return;
  }

  // Validate eightBallPoolId format (should be numeric)
  if (!/^\d+$/.test(eightBallPoolId)) {
    res.status(400).json({ 
      error: 'Invalid eightBallPoolId format. Must be numeric.' 
    });
    return;
  }

  // Validate username length and characters
  if (username.length < 1 || username.length > 50) {
    res.status(400).json({ 
      error: 'Username must be between 1 and 50 characters' 
    });
    return;
  }

  next();
};

export const validateContactForm = (req: Request, res: Response, next: NextFunction): void => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    res.status(400).json({ 
      error: 'Missing required fields',
      required: ['name', 'email', 'subject', 'message']
    });
    return;
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ 
      error: 'Invalid email format' 
    });
    return;
  }

  // Validate message length
  if (message.length < 10 || message.length > 1000) {
    res.status(400).json({ 
      error: 'Message must be between 10 and 1000 characters' 
    });
    return;
  }

  next();
};

