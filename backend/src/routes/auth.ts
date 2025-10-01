import express from 'express';
import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import { logger } from '../services/LoggerService';

const router = express.Router();

// Configure Discord OAuth2 strategy
passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID!,
  clientSecret: process.env.DISCORD_CLIENT_SECRET!,
  callbackURL: process.env.OAUTH_REDIRECT_URI!,
  scope: ['identify', 'email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user is in allowed admins list
    const allowedAdmins = process.env.ALLOWED_ADMINS?.split(',') || [];
    
    if (!allowedAdmins.includes(profile.id)) {
      logger.warn('Unauthorized Discord OAuth attempt', {
        action: 'oauth_unauthorized',
        discordId: profile.id,
        username: profile.username
      });
      return done(null, false, { message: 'Access denied. Admin privileges required.' });
    }

    logger.info('Discord OAuth successful', {
      action: 'oauth_success',
      discordId: profile.id,
      username: profile.username
    });

    return done(null, profile);
  } catch (error) {
    logger.error('Discord OAuth error', {
      action: 'oauth_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      discordId: profile.id
    });
    return done(error, false);
  }
}));

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user);
});

// Deserialize user from session
passport.deserializeUser((user: any, done) => {
  done(null, user);
});

// Initiate Discord OAuth2 login
router.get('/discord', passport.authenticate('discord'));

// Discord OAuth2 callback
router.get('/discord/callback', 
  passport.authenticate('discord', { failureRedirect: '/login?error=oauth_failed' }),
  (req, res) => {
    // Successful authentication, redirect to admin dashboard
    res.redirect(process.env.ADMIN_DASHBOARD_URL || '/admin-dashboard');
  }
);

// Get current user info
router.get('/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    const user = req.user as any;
    res.json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        avatar: user.avatar,
        email: user.email
      }
    });
  } else {
    res.json({
      authenticated: false,
      user: null
    });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      logger.error('Logout error', {
        action: 'logout_error',
        error: err.message
      });
      return res.status(500).json({ error: 'Logout failed' });
    }

    req.session.destroy((err) => {
      if (err) {
        logger.error('Session destruction error', {
          action: 'session_destroy_error',
          error: err.message
        });
        return res.status(500).json({ error: 'Session cleanup failed' });
      }

      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out successfully' });
    });
  });
});

  // Check authentication status
  router.get('/status', (req, res) => {
    // Development bypass - auto-authenticate in development mode
    if (process.env.NODE_ENV === 'development') {
      const allowedAdmins = process.env.ALLOWED_ADMINS?.split(',') || [];
      const devAdminId = allowedAdmins[0] || '850726663289700373'; // Use first admin or your ID
      
      return res.json({
        authenticated: true,
        isAdmin: true,
        user: {
          id: devAdminId,
          username: 'epildev',
          discriminator: '0000',
          avatar: 'dev-avatar'
        }
      });
    }
  
  const isAuthenticated = req.isAuthenticated && req.isAuthenticated();
  
  if (isAuthenticated) {
    const user = req.user as any;
    const allowedAdmins = process.env.ALLOWED_ADMINS?.split(',') || [];
    const isAdmin = allowedAdmins.includes(user.id);
    
    res.json({
      authenticated: true,
      isAdmin,
      user: {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        avatar: user.avatar
      }
    });
  } else {
    res.json({
      authenticated: false,
      isAdmin: false,
      user: null
    });
  }
});

export default router;


