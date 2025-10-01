import express from 'express';
import { Registration } from '../models/Registration';
import { ClaimRecord } from '../models/ClaimRecord';
import { LogEntry } from '../models/LogEntry';
import { logger } from '../services/LoggerService';
import { authenticateAdmin } from '../middleware/auth';

const router = express.Router();

// Apply admin authentication to all routes
router.use(authenticateAdmin);

// Get admin dashboard overview
router.get('/overview', async (req, res) => {
  try {
    const user = req.user as any;
    
    // Get registration count
    const totalRegistrations = await Registration.getRegistrationCount();
    
    // Get recent registrations (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentRegistrations = await Registration.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    // Get claim statistics (last 7 days)
    const claimStats = await ClaimRecord.getClaimStats(7);
    
    // Get log statistics (last 7 days)
    const logStats = await LogEntry.getLogStats(7);

    // Get recent claims
    const recentClaims = await ClaimRecord.getRecentClaims(10);

    res.json({
      registrations: {
        total: totalRegistrations,
        recent: recentRegistrations,
        period: '7 days'
      },
      claims: claimStats,
      logs: logStats,
      recentClaims: recentClaims.map(claim => ({
        eightBallPoolId: claim.eightBallPoolId,
        status: claim.status,
        itemsClaimed: claim.itemsClaimed,
        claimedAt: claim.claimedAt
      }))
    });

  } catch (error) {
    logger.error('Failed to retrieve admin overview', {
      action: 'admin_overview_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req.user as any)?.id
    });

    res.status(500).json({
      error: 'Failed to retrieve dashboard overview'
    });
  }
});

// Get all registrations with pagination
router.get('/registrations', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string;

    let filter = {};
    if (search) {
      filter = {
        $or: [
          { eightBallPoolId: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const registrations = await Registration.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Registration.countDocuments(filter);

    res.json({
      registrations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    logger.error('Failed to retrieve registrations for admin', {
      action: 'admin_registrations_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req.user as any)?.id
    });

    res.status(500).json({
      error: 'Failed to retrieve registrations'
    });
  }
});

// Add new registration (admin)
router.post('/registrations', async (req, res) => {
  try {
    const { eightBallPoolId, username } = req.body;

    if (!eightBallPoolId || !username) {
      return res.status(400).json({
        error: 'Missing required fields: eightBallPoolId, username'
      });
    }

    // Check if user already exists
    const existingUser = await Registration.findByEightBallPoolId(eightBallPoolId);
    if (existingUser) {
      return res.status(409).json({
        error: 'User with this 8 Ball Pool ID already exists'
      });
    }

    const registration = new Registration({
      eightBallPoolId,
      username
    });

    await registration.save();

    logger.logAdminAction((req.user as any)?.id, 'add_registration', {
      eightBallPoolId,
      username
    });

    res.status(201).json({
      message: 'Registration added successfully',
      registration
    });

  } catch (error) {
    logger.error('Failed to add registration', {
      action: 'admin_add_registration_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req.user as any)?.id
    });

    res.status(500).json({
      error: 'Failed to add registration'
    });
  }
});

// Remove registration (admin)
router.delete('/registrations/:eightBallPoolId', async (req, res) => {
  try {
    const { eightBallPoolId } = req.params;

    const registration = await Registration.findOneAndDelete({ eightBallPoolId });
    
    if (!registration) {
      return res.status(404).json({
        error: 'Registration not found'
      });
    }

    logger.logAdminAction((req.user as any)?.id, 'remove_registration', {
      eightBallPoolId,
      username: registration.username
    });

    res.json({
      message: 'Registration removed successfully',
      registration
    });

  } catch (error) {
    logger.error('Failed to remove registration', {
      action: 'admin_remove_registration_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req.user as any)?.id,
      eightBallPoolId: req.params.eightBallPoolId
    });

    res.status(500).json({
      error: 'Failed to remove registration'
    });
  }
});

// Get logs with pagination and filters
router.get('/logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const level = req.query.level as string;
    const service = req.query.service as string;
    const action = req.query.action as string;

    let filters: any = {};
    if (level) filters.level = level;
    if (service) filters.service = service;
    if (action) filters.action = action;

    const logs = await LogEntry.getLogsWithPagination(page, limit, filters);
    const total = await LogEntry.countDocuments(filters);

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    logger.error('Failed to retrieve logs for admin', {
      action: 'admin_logs_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req.user as any)?.id
    });

    res.status(500).json({
      error: 'Failed to retrieve logs'
    });
  }
});

// Manual claim trigger (admin)
router.post('/claim-all', async (req, res) => {
  try {
    // This would trigger the claim process manually
    // For now, return a placeholder response
    logger.logAdminAction((req.user as any)?.id, 'manual_claim_trigger', {
      timestamp: new Date().toISOString()
    });

    res.json({
      message: 'Manual claim process triggered',
      status: 'initiated',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to trigger manual claim', {
      action: 'admin_manual_claim_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req.user as any)?.id
    });

    res.status(500).json({
      error: 'Failed to trigger manual claim'
    });
  }
});

// Get claim totals for different timeframes
router.get('/claim-totals', async (req, res) => {
  try {
    const timeframes = ['7d', '14d', '28d'];
    const totals: any = {};

    for (const timeframe of timeframes) {
      const days = timeframe === '7d' ? 7 : timeframe === '14d' ? 14 : 28;
      const stats = await ClaimRecord.getClaimStats(days);
      totals[timeframe] = stats;
    }

    res.json(totals);

  } catch (error) {
    logger.error('Failed to retrieve claim totals', {
      action: 'admin_claim_totals_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req.user as any)?.id
    });

    res.status(500).json({
      error: 'Failed to retrieve claim totals'
    });
  }
});

// Search functionality
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    const type = req.query.type as string || 'all';

    if (!query) {
      return res.status(400).json({
        error: 'Search query is required'
      });
    }

    const results: any = {};

    if (type === 'all' || type === 'registrations') {
      const registrations = await Registration.find({
        $or: [
          { eightBallPoolId: { $regex: query, $options: 'i' } },
          { username: { $regex: query, $options: 'i' } }
        ]
      }).limit(10);

      results.registrations = registrations;
    }

    if (type === 'all' || type === 'claims') {
      const claims = await ClaimRecord.find({
        $or: [
          { eightBallPoolId: { $regex: query, $options: 'i' } },
          { itemsClaimed: { $in: [new RegExp(query, 'i')] } }
        ]
      }).sort({ claimedAt: -1 }).limit(10);

      results.claims = claims;
    }

    if (type === 'all' || type === 'logs') {
      const logs = await LogEntry.find({
        $or: [
          { message: { $regex: query, $options: 'i' } },
          { userId: { $regex: query, $options: 'i' } },
          { action: { $regex: query, $options: 'i' } }
        ]
      }).sort({ timestamp: -1 }).limit(10);

      results.logs = logs;
    }

    res.json({
      query,
      type,
      results
    });

  } catch (error) {
    logger.error('Admin search failed', {
      action: 'admin_search_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req.user as any)?.id,
      query: req.query.q
    });

    res.status(500).json({
      error: 'Search failed'
    });
  }
});

// Toggle notifications (placeholder)
router.post('/notifications/toggle', async (req, res) => {
  try {
    const { enabled } = req.body;

    logger.logAdminAction((req.user as any)?.id, 'toggle_notifications', {
      enabled,
      timestamp: new Date().toISOString()
    });

    res.json({
      message: 'Notification settings updated',
      enabled,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to toggle notifications', {
      action: 'admin_toggle_notifications_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req.user as any)?.id
    });

    res.status(500).json({
      error: 'Failed to update notification settings'
    });
  }
});

// Block/Unblock user
router.post('/users/:eightBallPoolId/block', async (req, res) => {
  try {
    const { eightBallPoolId } = req.params;
    const { isBlocked, reason } = req.body;

    const registration = await Registration.findByEightBallPoolId(eightBallPoolId);
    
    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    registration.isBlocked = isBlocked;
    registration.blockedReason = isBlocked ? reason : undefined;
    await registration.save();

    logger.logAdminAction((req.user as any)?.id, isBlocked ? 'block_user' : 'unblock_user', {
      eightBallPoolId,
      username: registration.username,
      reason
    });

    res.json({
      message: isBlocked ? 'User blocked successfully' : 'User unblocked successfully',
      user: {
        eightBallPoolId: registration.eightBallPoolId,
        username: registration.username,
        isBlocked: registration.isBlocked,
        blockedReason: registration.blockedReason
      }
    });

  } catch (error) {
    logger.error('Failed to block/unblock user', {
      action: 'admin_block_user_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req.user as any)?.id
    });

    res.status(500).json({
      error: 'Failed to block/unblock user'
    });
  }
});

export default router;


