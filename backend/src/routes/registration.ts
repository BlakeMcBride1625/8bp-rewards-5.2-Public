import express from 'express';
import { Registration } from '../models/Registration';
import { ClaimRecord } from '../models/ClaimRecord';
import { logger } from '../services/LoggerService';
import DiscordNotificationService from '../services/DiscordNotificationService';
import { validateRegistration } from '../middleware/auth';
import { exec } from 'child_process';
import path from 'path';

const router = express.Router();

// Register a new user
router.post('/', validateRegistration, async (req, res) => {
  try {
    const { eightBallPoolId, username } = req.body;

    // Check if user already exists
    const existingUser = await Registration.findByEightBallPoolId(eightBallPoolId);
    
    if (existingUser) {
      logger.warn('Registration attempt with existing 8BP ID', {
        action: 'registration_duplicate',
        eightBallPoolId,
        username
      });
      
      return res.status(409).json({
        error: 'User with this 8 Ball Pool ID is already registered',
        eightBallPoolId
      });
    }

    // Create new registration
    const registration = new Registration({
      eightBallPoolId,
      username,
      registrationIp: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      isBlocked: false
    });

    await registration.save();

    logger.logRegistration(eightBallPoolId, username, req.ip);

    // Send Discord notification for new registration
    const discordNotification = new DiscordNotificationService();
    discordNotification.sendRegistrationNotification(
      eightBallPoolId, 
      username, 
      req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown'
    ).catch(error => {
      logger.error('Discord notification failed (non-blocking)', {
        action: 'discord_notification_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    });

    // Trigger immediate first-time claim for this user in the background
    const projectRoot = path.join(__dirname, '../../..');
    const claimScript = path.join(projectRoot, 'first-time-claim.js');
    
    logger.info('Triggering first-time claim for new user', {
      action: 'first_claim_trigger',
      eightBallPoolId,
      username
    });
    
    // Run claim in background (don't wait for it)
    exec(`cd ${projectRoot} && node ${claimScript} ${eightBallPoolId} "${username}"`, (error, stdout, stderr) => {
      if (error) {
        logger.error('First-time claim failed', {
          action: 'first_claim_error',
          eightBallPoolId,
          error: error.message
        });
      } else {
        logger.info('First-time claim completed', {
          action: 'first_claim_success',
          eightBallPoolId,
          output: stdout
        });
      }
    });

    res.status(201).json({
      message: 'Registration successful',
      user: {
        eightBallPoolId: registration.eightBallPoolId,
        username: registration.username,
        createdAt: registration.createdAt
      },
      firstClaim: 'Triggered - rewards will be claimed in the background'
    });

  } catch (error) {
    logger.error('Registration failed', {
      action: 'registration_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip
    });

    res.status(500).json({
      error: 'Registration failed. Please try again.'
    });
  }
});

// Get all registrations (for admin use)
router.get('/', async (req, res) => {
  try {
    const registrations = await Registration.getAllRegistrations();
    
    res.json({
      count: registrations.length,
      registrations: registrations.map((reg: any) => ({
        eightBallPoolId: reg.eightBallPoolId,
        username: reg.username,
        createdAt: reg.createdAt,
        updatedAt: reg.updatedAt
      }))
    });

  } catch (error) {
    logger.error('Failed to retrieve registrations', {
      action: 'get_registrations_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      error: 'Failed to retrieve registrations'
    });
  }
});

// Get registration by 8BP ID
router.get('/:eightBallPoolId', async (req, res) => {
  try {
    const { eightBallPoolId } = req.params;

    const registration = await Registration.findByEightBallPoolId(eightBallPoolId);
    
    if (!registration) {
      return res.status(404).json({
        error: 'Registration not found'
      });
    }

    res.json({
      eightBallPoolId: registration.eightBallPoolId,
      username: registration.username,
      createdAt: registration.createdAt,
      updatedAt: registration.updatedAt
    });

  } catch (error) {
    logger.error('Failed to retrieve registration', {
      action: 'get_registration_error',
      eightBallPoolId: req.params.eightBallPoolId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      error: 'Failed to retrieve registration'
    });
  }
});

// Get user's claim history
router.get('/:eightBallPoolId/claims', async (req, res) => {
  try {
    const { eightBallPoolId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    // Verify user exists
    const registration = await Registration.findByEightBallPoolId(eightBallPoolId);
    if (!registration) {
      return res.status(404).json({
        error: 'Registration not found'
      });
    }

    const claims = await ClaimRecord.getClaimsByUser(eightBallPoolId, limit);

    res.json({
      eightBallPoolId,
      username: registration.username,
      claims: claims.map((claim: any) => ({
        status: claim.status,
        itemsClaimed: claim.itemsClaimed,
        error: claim.error,
        claimedAt: claim.claimedAt,
        schedulerRun: claim.schedulerRun
      }))
    });

  } catch (error) {
    logger.error('Failed to retrieve user claims', {
      action: 'get_user_claims_error',
      eightBallPoolId: req.params.eightBallPoolId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      error: 'Failed to retrieve claim history'
    });
  }
});

// Get registration statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const totalRegistrations = await Registration.getRegistrationCount();
    
    // Get recent registrations (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentRegistrations = await Registration.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    res.json({
      totalRegistrations,
      recentRegistrations,
      period: '7 days'
    });

  } catch (error) {
    logger.error('Failed to retrieve registration stats', {
      action: 'get_registration_stats_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      error: 'Failed to retrieve statistics'
    });
  }
});

export default router;

