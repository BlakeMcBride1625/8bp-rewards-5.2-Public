import express from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { logger } from '../services/LoggerService';
import { HeartbeatRegistry } from '../services/HeartbeatRegistry';
import { authenticateAdmin } from '../middleware/auth';
import DiscordNotificationService from '../services/DiscordNotificationService';
import TelegramNotificationService from '../services/TelegramNotificationService';
import { EmailNotificationService } from '../services/EmailNotificationService';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { DeviceDetectionService } from '../services/DeviceDetectionService';
import { BlockingService } from '../services/BlockingService';
import { checkDeviceBlocking, logDeviceInfo } from '../middleware/deviceBlocking';
import crypto from 'crypto';
import axios from 'axios';
import WebSocketService from '../services/WebSocketService';
import { isAllowedForVPS, isAllowedForTelegram, isAllowedForEmail } from '../utils/permissions';
import { AdminRequest } from '../types/auth';
import { getRandom8BPAvatar } from '../utils/avatarUtils';

// VPS codes and access are now stored in the database (see DatabaseService methods)
// Removed global in-memory storage declarations

const router = express.Router();
const dbService = DatabaseService.getInstance();
const deviceDetectionService = DeviceDetectionService.getInstance();
const blockingService = BlockingService.getInstance();

// Public bot status endpoint (no auth required)
router.get('/bot-status-public', async (req, res) => {
  try {
    // Make a request to the Discord bot service to get current status
    const discordPort = process.env.DISCORD_API_PORT || '2700';
    // In Docker, use service name; otherwise use localhost
    const botServiceUrl = process.env.DISCORD_BOT_SERVICE_URL || 
      (process.env.NODE_ENV === 'production' && process.env.POSTGRES_HOST === 'postgres' 
        ? `http://discord-api:${discordPort}` 
        : `http://localhost:${discordPort}`);
    
    try {
      const response = await axios.get(`${botServiceUrl}/api/bot-status`, {
        timeout: 5000
      });
      
      return res.json({
        success: true,
        data: response.data
      });
    } catch (botError) {
      // If bot service is not available, return basic info
      return res.json({
        success: true,
        data: {
          success: true,
          currentStatus: 'offline',
          environmentStatus: 'dnd',
          botReady: false,
          botTag: null,
          message: 'Bot service unavailable'
        }
      });
    }
    
  } catch (error: any) {
    logger.error('Error in bot status endpoint:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get bot status',
      details: error.message
    });
  }
});

// Apply admin authentication to all remaining routes
router.use(authenticateAdmin);

// Request throttling middleware for admin endpoints
const requestCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 2000; // 2 seconds cache to prevent duplicate requests

const throttleAdminRequest = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  const cacheKey = `${req.method}:${req.path}:${(req.user as any)?.id}`;
  const cached = requestCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    res.json(cached.data);
    return;
  }
  
  // Store original json method
  const originalJson = res.json.bind(res);
  res.json = function(data: any) {
    requestCache.set(cacheKey, { data, timestamp: Date.now() });
    // Clean old cache entries (older than 10 seconds)
    for (const [key, value] of requestCache.entries()) {
      if (Date.now() - value.timestamp > 10000) {
        requestCache.delete(key);
      }
    }
    return originalJson(data);
  };
  
  next();
};

// Get admin dashboard overview
router.get('/overview', throttleAdminRequest, async (req, res) => {
  try {
    const user = req.user as any;
    
    // Get registration count - need to get array length
    const allRegistrations = await dbService.findRegistrations();
    const totalRegistrationsCount = Array.isArray(allRegistrations) ? allRegistrations.length : 0;
    
    // Get recent registrations (last 7 days) using direct SQL query
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    let recentRegistrationsCount = 0;
    try {
      const result = await dbService.executeQuery(
        'SELECT COUNT(*) as count FROM registrations WHERE created_at >= $1',
        [sevenDaysAgo]
      );
      recentRegistrationsCount = parseInt(result.rows[0].count);
    } catch (error) {
      logger.warn('Failed to get recent registrations count', { error: error instanceof Error ? error.message : 'Unknown error' });
    }

    // Get claim statistics - match leaderboard query format (last 7 days for consistency)
    // This ensures dashboard matches leaderboard data
    const sevenDaysAgoForClaims = new Date();
    sevenDaysAgoForClaims.setDate(sevenDaysAgoForClaims.getDate() - 7);
    
    // Use the same query format as leaderboard for consistency
    let claimStats: any[] = [];
    try {
      // Exclude failed claims where user has successful claim on same day (duplicate attempts, not real failures)
      const claimStatsQuery = `
        SELECT 
          cr.status as _id,
          COUNT(*) as count,
          COALESCE(SUM(ARRAY_LENGTH(cr.items_claimed, 1)) FILTER (WHERE cr.status = 'success'), 0) as totalitems
        FROM claim_records cr
        WHERE cr.claimed_at >= $1
        AND (
          cr.status = 'success' 
          OR (
            cr.status = 'failed' 
            AND NOT EXISTS (
              SELECT 1 FROM claim_records cr2 
              WHERE cr2.eight_ball_pool_id = cr.eight_ball_pool_id 
              AND cr2.status = 'success' 
              AND DATE(cr2.claimed_at) = DATE(cr.claimed_at)
              AND cr2.claimed_at >= $1
            )
          )
        )
        GROUP BY cr.status
      `;
      const claimResult = await dbService.executeQuery(claimStatsQuery, [sevenDaysAgoForClaims]);
      
      claimStats = claimResult.rows.map((row: any) => ({
        _id: row._id,
        count: parseInt(row.count),
        totalitems: parseInt(row.totalitems) || 0
      }));
      
      // Ensure we always have entries for 'success' and 'failed' even if count is 0
      if (!claimStats.find((c: any) => c._id === 'success')) {
        claimStats.push({ _id: 'success', count: 0, totalitems: 0 });
      }
      if (!claimStats.find((c: any) => c._id === 'failed')) {
        claimStats.push({ _id: 'failed', count: 0, totalitems: 0 });
      }
      
      logger.info('Admin overview - claim stats calculated', {
        action: 'admin_overview_claim_stats',
        claimStats,
        period: '7 days'
      });
    } catch (error) {
      logger.warn('Failed to get claim stats, using fallback', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      // Fallback to all-time stats if timeframe query fails
      claimStats = await dbService.getClaimStats();
    }
    
    // Get log statistics (last 7 days) from database - CACHED to prevent excessive queries
    let logStats: any[] = [];
    try {
      const logStatsCacheKey = 'admin_overview_log_stats';
      const cachedLogStats = requestCache.get(logStatsCacheKey);
      let logStatsResult;
      
      if (cachedLogStats && Date.now() - cachedLogStats.timestamp < 30000) { // 30 second cache
        logStatsResult = cachedLogStats.data;
      } else {
        // Use database service instead of creating new pool (prevents connection leaks)
        const result = await dbService.executeQuery(`
          SELECT level, COUNT(*) as count 
          FROM log_entries 
          WHERE timestamp > NOW() - INTERVAL '7 days'
          GROUP BY level
        `);
        logStatsResult = result;
        requestCache.set(logStatsCacheKey, { data: logStatsResult, timestamp: Date.now() });
      }
      
      // Convert to array format
      logStats = logStatsResult.rows.map((row: any) => ({
        _id: row.level,
        count: parseInt(row.count),
        latest: new Date().toISOString()
      }));
    } catch (error) {
      logger.warn('Failed to read log statistics from database', { error: error instanceof Error ? error.message : 'Unknown error' });
    }

    // Get recent claims (last 7 days, same as leaderboard for consistency)
    const sevenDaysAgoForRecent = new Date();
    sevenDaysAgoForRecent.setDate(sevenDaysAgoForRecent.getDate() - 7);
    const recentClaims = await dbService.findClaimRecords({
      claimedAt: { $gte: sevenDaysAgoForRecent }
    });
    
    // Debug logging for claim status
    logger.info('Admin overview - recent claims debug', {
      action: 'admin_overview_debug',
      totalClaims: recentClaims.length,
      claimStatuses: recentClaims.slice(0, 5).map((claim: any) => ({
        id: claim.id,
        eightBallPoolId: claim.eightBallPoolId,
        status: claim.status,
        itemsClaimed: claim.itemsClaimed,
        claimedAt: claim.claimedAt
      }))
    });

    // Map recent claims with screenshot paths from metadata
    const mappedRecentClaims = recentClaims.slice(0, 10).map((claim: any) => {
      // Extract screenshot path from metadata if available
      const metadata = typeof claim.metadata === 'object' 
        ? claim.metadata 
        : (claim.metadata ? JSON.parse(claim.metadata) : {});
      
      const screenshotPath = metadata.screenshotPath || metadata.confirmationImagePath || null;
      
      return {
        eightBallPoolId: claim.eightBallPoolId,
        status: claim.status,
        itemsClaimed: claim.itemsClaimed || [],
        claimedAt: claim.claimedAt,
        screenshotPath: screenshotPath,
        // Get username from registration if available
        username: null // Will be populated if needed
      };
    });
    
    // Optionally enrich with usernames
    try {
      const userIds = mappedRecentClaims.map(c => c.eightBallPoolId);
      if (userIds.length > 0) {
        const usernameQuery = `
          SELECT eight_ball_pool_id, username 
          FROM registrations 
          WHERE eight_ball_pool_id = ANY($1)
        `;
        const usernameResult = await dbService.executeQuery(usernameQuery, [userIds]);
        const usernameMap = new Map();
        usernameResult.rows.forEach((row: any) => {
          usernameMap.set(row.eight_ball_pool_id, row.username);
        });
        
        mappedRecentClaims.forEach(claim => {
          claim.username = usernameMap.get(claim.eightBallPoolId) || null;
        });
      }
    } catch (error) {
      logger.warn('Failed to fetch usernames for recent claims', { error: error instanceof Error ? error.message : 'Unknown error' });
    }

    res.json({
      registrations: {
        total: totalRegistrationsCount,
        recent: recentRegistrationsCount,
        period: '7 days'
      },
      claims: claimStats,
      logs: logStats,
      recentClaims: mappedRecentClaims
    });

  } catch (error) {
    logger.error('Failed to retrieve admin overview', {
      action: 'admin_overview_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as AdminRequest).user?.id
    });

    res.status(500).json({
      error: 'Failed to retrieve dashboard overview'
    });
  }
});

// Heartbeat admin proxy endpoints (surface summary into admin routes)
router.get('/heartbeat/summary', async (req, res) => {
  const registry = HeartbeatRegistry.getInstance();
  return res.json({ success: true, data: registry.getSummary() });
});
router.get('/heartbeat/active', async (req, res) => {
  const registry = HeartbeatRegistry.getInstance();
  return res.json({ success: true, data: registry.getActiveRecords() });
});

// Get user count from database
router.get('/user-count', async (req, res) => {
  try {
    await dbService.connect();
    
    // Get total user count
    const query = `
      SELECT COUNT(*) as total FROM registrations
    `;
    const result = await dbService.executeQuery(query);
    const totalUsers = parseInt(result.rows[0].total);
    
    // Get active user count
    const activeQuery = `
      SELECT COUNT(*) as total 
      FROM registrations 
      WHERE status = 'active' OR status IS NULL
    `;
    const activeResult = await dbService.executeQuery(activeQuery);
    const activeUsers = parseInt(activeResult.rows[0].total);
    
    // Get inactive user count
    const inactiveQuery = `
      SELECT COUNT(*) as total 
      FROM registrations 
      WHERE status != 'active' AND status IS NOT NULL
    `;
    const inactiveResult = await dbService.executeQuery(inactiveQuery);
    const inactiveUsers = parseInt(inactiveResult.rows[0].total);
    
    // Get invalid users count
    const invalidQuery = 'SELECT COUNT(*) as total FROM invalid_users';
    const invalidResult = await dbService.executeQuery(invalidQuery);
    const invalidUsers = parseInt(invalidResult.rows[0].total);
    
    res.json({
      success: true,
      data: {
        total: totalUsers,
        active: activeUsers,
        inactive: inactiveUsers,
        invalid: invalidUsers,
        expected: 63,
        matches: totalUsers === 63
      }
    });
  } catch (error: any) {
    logger.error('Failed to get user count', {
      action: 'get_user_count_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get user count',
      details: error.message
    });
  }
});

// Get test users configuration
router.get('/test-users', throttleAdminRequest, async (req, res) => {
  try {
    // Default test users - can be configured via environment variables
    const defaultTestUsers = [
      { id: '1826254746', username: 'TestUser1', description: 'Primary test user' },
      { id: '3057211056', username: 'TestUser2', description: 'Secondary test user' },
      { id: '110141', username: 'TestUser3', description: 'Tertiary test user' }
    ];

    // Check if custom test users are configured via environment
    const customTestUsers = process.env.TEST_USERS;
    let testUsers = defaultTestUsers;

    if (customTestUsers) {
      try {
        const parsed = JSON.parse(customTestUsers);
        if (Array.isArray(parsed)) {
          testUsers = parsed;
        }
      } catch (error) {
        logger.warn('Failed to parse TEST_USERS environment variable', {
          action: 'test_users_parse_error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    res.json({
      testUsers,
      configured: !!customTestUsers,
      count: testUsers.length
    });

  } catch (error) {
    logger.error('Failed to retrieve test users', {
      action: 'admin_test_users_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as AdminRequest).user?.id
    });

    res.status(500).json({
      error: 'Failed to retrieve test users'
    });
  }
});

// Get all registrations with pagination
router.get('/registrations', throttleAdminRequest, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string;

    // Use direct SQL query for PostgreSQL with search support
    let sql = 'SELECT * FROM registrations WHERE 1=1';
    const values: any[] = [];
    let paramCount = 0;

    if (search) {
      sql += ` AND (eight_ball_pool_id ILIKE $${++paramCount} OR username ILIKE $${++paramCount})`;
      const searchPattern = `%${search}%`;
      values.push(searchPattern, searchPattern);
    }

    sql += ' ORDER BY created_at DESC';
    
    // Apply pagination
    const offset = (page - 1) * limit;
    sql += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    values.push(limit, offset);

    const result = await dbService.executeQuery(sql, values);
    
    // Get total count for pagination
    let countSql = 'SELECT COUNT(*) as total FROM registrations WHERE 1=1';
    const countValues: any[] = [];
    let countParamCount = 0;
    
    if (search) {
      countSql += ` AND (eight_ball_pool_id ILIKE $${++countParamCount} OR username ILIKE $${++countParamCount})`;
      const searchPattern = `%${search}%`;
      countValues.push(searchPattern, searchPattern);
    }
    
    const countResult = await dbService.executeQuery(countSql, countValues);
    const total = parseInt(countResult.rows[0].total);

    // Map results and include claim statistics
    const registrations = await Promise.all(
      result.rows.map(async (row: any) => {
        // Get claim statistics for this user
        const successResult = await dbService.executeQuery(
          `SELECT COUNT(*) as count FROM claim_records 
           WHERE eight_ball_pool_id = $1 AND status = 'success'`,
          [row.eight_ball_pool_id]
        );
        const failedResult = await dbService.executeQuery(
          `SELECT COUNT(*) as count FROM claim_records 
           WHERE eight_ball_pool_id = $1 AND status = 'failed'`,
          [row.eight_ball_pool_id]
        );

        const successfulClaims = parseInt(successResult.rows[0]?.count || '0');
        const failedClaims = parseInt(failedResult.rows[0]?.count || '0');

        return {
          _id: row.id,
          eightBallPoolId: row.eight_ball_pool_id,
          username: row.username,
          email: row.email,
          discordId: row.discord_id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          isActive: row.is_active,
          metadata: row.metadata,
          successfulClaims,
          failedClaims,
          registrationIp: row.registration_ip,
          deviceId: row.device_id,
          deviceType: row.device_type,
          isBlocked: row.is_blocked,
          blockedReason: row.blocked_reason
        };
      })
    );

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
      adminId: (req as AdminRequest).user?.id
    });

    res.status(500).json({
      error: 'Failed to retrieve registrations'
    });
  }
});

// Add new registration (admin)
router.post('/registrations', checkDeviceBlocking, logDeviceInfo, async (req, res): Promise<void> => {
  try {
    const { eightBallPoolId, username } = req.body;

    if (!eightBallPoolId || !username) {
      res.status(400).json({
        error: 'Missing required fields: eightBallPoolId, username'
      });
      return;
    }

    // Check if user already exists
    const existingUser = await dbService.findRegistration({ eightBallPoolId });
    if (existingUser) {
      res.status(409).json({
        error: 'User with this 8 Ball Pool ID already exists'
      });
      return;
    }

    // Extract client IP with better proxy handling
    logger.debug('Admin IP Detection Debug - Starting IP detection', {
      action: 'admin_ip_detection',
      username
    });
    const clientIP = req.ip || 
                     req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
                     req.headers['x-real-ip']?.toString() ||
                     req.headers['cf-connecting-ip']?.toString() ||
                     req.connection?.remoteAddress ||
                     req.socket?.remoteAddress ||
                     'Admin Dashboard';
    logger.debug('Admin IP Detection Debug - Final clientIP', {
      action: 'admin_ip_detection',
      username,
      clientIP
    });

    // Extract device information
    const deviceInfo = deviceDetectionService.extractDeviceInfo(req);
    
    logger.info('Admin device detection completed', {
      action: 'admin_device_detection',
      eightBallPoolId,
      username,
      deviceId: deviceInfo.deviceId.substring(0, 8) + '...', // Log partial ID for privacy
      deviceType: deviceInfo.deviceType,
      platform: deviceInfo.platform,
      browser: deviceInfo.browser
    });

    // Create new registration (no random avatar assignment)
    const registration = await dbService.createRegistration({
      eightBallPoolId,
      username,
      registrationIp: clientIP,
      deviceId: deviceInfo.deviceId,
      deviceType: deviceInfo.deviceType,
      userAgent: deviceInfo.userAgent,
      lastLoginAt: new Date(),
      eight_ball_pool_avatar_filename: null
    });

    logger.logAdminAction((req as AdminRequest).user?.id || 'unknown', 'add_registration', {
      eightBallPoolId,
      username
    });

    // Send Discord notification for admin-added registration
    const discordNotification = new DiscordNotificationService();
    discordNotification.sendRegistrationNotification(
      eightBallPoolId, 
      username, 
      clientIP
    ).catch(error => {
      logger.error('Discord notification failed (non-blocking)', {
        action: 'discord_notification_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    });

    // Trigger registration validation first (same as normal registration)
    // If validation passes, it will automatically trigger first-time claim (Stage 2)
    logger.info('Triggering registration validation for admin-added user', {
      action: 'registration_validation_trigger',
      eightBallPoolId,
      username
    });
    
    // Trigger registration validation in background
    // Run in background (don't await - let it run async)
    (async () => {
      try {
        logger.info('🚀 ASYNC VALIDATION STARTED', { eightBallPoolId, username });
        
        // Use spawn with better error handling
        const { spawn } = require('child_process');
        
        // Resolve script path - works in both dev and Docker
        // In dev: backend/src/scripts/registration-validation.ts
        // In Docker compiled: dist/backend/backend/src/scripts/registration-validation.ts
        // Try multiple possible locations
        const possiblePaths = [
          path.join(process.cwd(), 'backend/src/scripts/registration-validation.ts'),
          path.join(process.cwd(), 'dist/backend/backend/src/scripts/registration-validation.ts'),
          path.join(__dirname, '../scripts/registration-validation.ts'),
          path.join(__dirname, '../../backend/src/scripts/registration-validation.ts'),
          path.resolve(__dirname, '../../backend/src/scripts/registration-validation.ts')
        ];
        
        let validationScript: string | null = null;
        const fs = require('fs');
        for (const scriptPath of possiblePaths) {
          try {
            if (fs.existsSync(scriptPath)) {
              validationScript = scriptPath;
              break;
            }
          } catch (e) {
            // Continue to next path
          }
        }
        
        if (!validationScript) {
          logger.error('Registration validation script not found', {
            action: 'validation_script_not_found',
            eightBallPoolId,
            username,
            triedPaths: possiblePaths
          });
          return;
        }
        
        logger.info('Running registration validation script', { 
          eightBallPoolId, 
          username, 
          script: validationScript,
          cwd: process.cwd()
        });
        
        // Determine if tsx is available (dev) or use node with compiled JS
        // Check if script is .ts (needs tsx) or .js (can use node)
        // validationScript is guaranteed non-null after the check above
        const isTypeScript = validationScript.endsWith('.ts');
        const command = isTypeScript ? 'npx' : 'node';
        const args = isTypeScript 
          ? ['tsx', validationScript, eightBallPoolId, username]
          : [validationScript, eightBallPoolId, username];
        
        const validationProcess = spawn(command, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          cwd: process.cwd(),
          detached: false,
          env: {
            ...process.env,
            NODE_ENV: process.env.NODE_ENV || 'production'
          }
        });
        
        // Set a timeout to kill the process if it hangs
        const timeout = setTimeout(() => {
          logger.warn('Validation process timeout - killing process', { eightBallPoolId, username });
          validationProcess.kill('SIGKILL');
        }, 300000); // 5 minutes timeout
        
        let stdout = '';
        let stderr = '';
        
        validationProcess.stdout?.on('data', (data: Buffer) => {
          stdout += data.toString();
          // Log progress in real-time
          const lines = data.toString().split('\n').filter(line => line.trim());
          lines.forEach(line => {
            if (line.includes('[VALIDATION]') || line.includes('[STAGE_2]') || line.includes('✅') || line.includes('❌')) {
              logger.info('Validation progress', { 
                eightBallPoolId, 
                username, 
                progress: line.trim() 
              });
            }
          });
        });
        
        validationProcess.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString();
          logger.warn('Validation stderr', { 
            eightBallPoolId, 
            username, 
            stderr: data.toString().trim() 
          });
        });
        
        validationProcess.on('close', (code: number | null) => {
          clearTimeout(timeout);
          if (code === 0) {
            logger.info('Registration validation completed successfully', {
              action: 'validation_completed',
              eightBallPoolId,
              username,
              stdout: stdout.substring(0, 1000),
              stderr: stderr.substring(0, 500)
            });
          } else {
            logger.error('Registration validation failed', {
              action: 'validation_error',
              eightBallPoolId,
              username,
              exitCode: code,
              stdout: stdout.substring(0, 1000),
              stderr: stderr.substring(0, 500)
            });
          }
        });
        
        validationProcess.on('error', (error: Error) => {
          clearTimeout(timeout);
          logger.error('Validation process error', {
            action: 'validation_process_error',
            eightBallPoolId,
            username,
            error: error.message
          });
        });
        
      } catch (error) {
        logger.error('Registration validation error', {
          action: 'validation_error',
          eightBallPoolId,
          username,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    })();

    res.status(201).json({
      message: 'Registration added successfully',
      user: {
        eightBallPoolId: registration.eightBallPoolId,
        username: registration.username,
        createdAt: registration.createdAt
      },
      validation: 'Triggered - validation will run in the background and trigger first-time claim if valid'
    });

  } catch (error) {
    logger.error('Failed to add registration', {
      action: 'admin_add_registration_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as AdminRequest).user?.id
    });

    res.status(500).json({
      error: 'Failed to add registration'
    });
  }
});

// Remove registration (admin)
router.delete('/registrations/:eightBallPoolId', async (req, res): Promise<void> => {
  try {
    const { eightBallPoolId } = req.params;

    const registration = await dbService.findRegistration({ eightBallPoolId });
    
    if (!registration) {
      res.status(404).json({
        error: 'Registration not found'
      });
      return;
    }

    await dbService.deleteRegistration(eightBallPoolId);

    logger.logAdminAction((req as AdminRequest).user?.id || 'unknown', 'remove_registration', {
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
      adminId: (req as AdminRequest).user?.id,
      eightBallPoolId: req.params.eightBallPoolId
    });

    res.status(500).json({
      error: 'Failed to remove registration'
    });
  }
});

// Completely remove a user from all tables (fresh start)
router.delete('/deregistered-users/:eightBallPoolId/remove', authenticateAdmin, async (req, res): Promise<void> => {
  try {
    const { eightBallPoolId } = req.params;

    if (!eightBallPoolId) {
      res.status(400).json({
        error: 'Eight Ball Pool ID is required'
      });
      return;
    }

    logger.info('Starting complete user removal', {
      action: 'admin_complete_user_removal',
      eightBallPoolId,
      adminId: (req as AdminRequest).user?.id
    });

    // Remove from all tables
    const results = {
      registrations: 0,
      invalidUsers: 0,
      claimRecords: 0,
      validationLogs: 0
    };

    // 1. Remove from registrations
    try {
      await dbService.deleteRegistration(eightBallPoolId);
      results.registrations = 1;
    } catch (error) {
      logger.debug('No registration found or already deleted', { eightBallPoolId });
    }

    // Ensure database is connected
    await dbService.connect();

    // 2. Remove from invalid_users (deregistered users)
    try {
      const result = await dbService.executeQuery(
        'DELETE FROM invalid_users WHERE eight_ball_pool_id = $1',
        [eightBallPoolId]
      );
      results.invalidUsers = result.rowCount || 0;
    } catch (error) {
      logger.debug('No invalid user record found or already deleted', { eightBallPoolId });
    }

    // 3. Remove from claim_records
    try {
      const result = await dbService.executeQuery(
        'DELETE FROM claim_records WHERE eight_ball_pool_id = $1',
        [eightBallPoolId]
      );
      results.claimRecords = result.rowCount || 0;
    } catch (error) {
      logger.debug('No claim records found or already deleted', { eightBallPoolId });
    }

    // 4. Remove from validation_logs
    try {
      const result = await dbService.executeQuery(
        'DELETE FROM validation_logs WHERE unique_id = $1',
        [eightBallPoolId]
      );
      results.validationLogs = result.rowCount || 0;
    } catch (error) {
      logger.debug('No validation logs found or already deleted', { eightBallPoolId });
    }

    logger.logAdminAction((req as AdminRequest).user?.id || 'unknown', 'complete_user_removal', {
      eightBallPoolId,
      results
    });

    res.json({
      success: true,
      message: 'User completely removed from all tables',
      eightBallPoolId,
      removed: results
    });

  } catch (error) {
    logger.error('Failed to completely remove user', {
      action: 'admin_complete_user_removal_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as AdminRequest).user?.id,
      eightBallPoolId: req.params.eightBallPoolId
    });

    res.status(500).json({
      error: 'Failed to completely remove user',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Remove failed claims (admin)
router.delete('/claim-records/failed', async (req, res): Promise<void> => {
  try {
    const cleanupResult = await dbService.cleanupFailedClaims();

    logger.logAdminAction((req as AdminRequest).user?.id || 'unknown', 'clear_failed_claims', {
      removedClaimRecords: cleanupResult.removedClaimRecords,
      removedLogEntries: cleanupResult.removedLogEntries,
      removedValidationLogs: cleanupResult.removedValidationLogs
    });

    res.json({
      message: 'Failed claims removed successfully',
      deletedCount: cleanupResult.removedClaimRecords,
      removedClaimRecords: cleanupResult.removedClaimRecords,
      removedLogEntries: cleanupResult.removedLogEntries,
      removedValidationLogs: cleanupResult.removedValidationLogs
    });

  } catch (error) {
    logger.error('Failed to remove failed claims', {
      action: 'admin_clear_failed_claims_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as AdminRequest).user?.id
    });

    res.status(500).json({
      error: 'Failed to remove failed claims'
    });
  }
});

// Get logs with pagination and filters
router.get('/logs', throttleAdminRequest, async (req, res) => {
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

    // Read from PostgreSQL database using dbService (prevents connection leaks)
    let logs: any[] = [];
    
    try {
      // Build query with filters
      let query = 'SELECT * FROM log_entries WHERE 1=1';
      const queryParams: any[] = [];
      let paramCount = 0;
      
      if (level) {
        query += ` AND level = $${++paramCount}`;
        queryParams.push(level);
      }
      if (service) {
        query += ` AND service = $${++paramCount}`;
        queryParams.push(service);
      }
      if (action) {
        query += ` AND metadata->>'action' = $${++paramCount}`;
        queryParams.push(action);
      }
      
      query += ` ORDER BY timestamp DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
      queryParams.push(limit, (page - 1) * limit);
      
      const result = await dbService.executeQuery(query, queryParams);
      logs = result.rows.map((row: any) => ({
        id: row.id,
        timestamp: row.timestamp,
        level: row.level,
        message: row.message,
        service: row.service,
        metadata: row.metadata
      }));
      
      // Get total count for pagination
      let countQuery = 'SELECT COUNT(*) as total FROM log_entries WHERE 1=1';
      const countParams: any[] = [];
      let countParamCount = 0;
      
      if (level) {
        countQuery += ` AND level = $${++countParamCount}`;
        countParams.push(level);
      }
      if (service) {
        countQuery += ` AND service = $${++countParamCount}`;
        countParams.push(service);
      }
      if (action) {
        countQuery += ` AND metadata->>'action' = $${++countParamCount}`;
        countParams.push(action);
      }
      
      const countResult = await dbService.executeQuery(countQuery, countParams);
      const total = parseInt(countResult.rows[0].total);
      
      res.json({
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
      
      return;
    } catch (dbError) {
      logger.error('Database query error', {
        action: 'database_query_error',
        error: dbError instanceof Error ? dbError.message : 'Unknown error'
      });
      
      // Fallback to reading from log files
      const fs = require('fs');
      const path = require('path');
      
      try {
        // Read from combined log file
        const logPath = path.join(__dirname, '../../../../../logs/combined.log');
        if (fs.existsSync(logPath)) {
          const logContent = fs.readFileSync(logPath, 'utf8');
        const logLines = logContent.split('\n').filter((line: string) => line.trim());
        
        logs = logLines.slice(-100).map((line: string, index: number) => {
          try {
            const parsed = JSON.parse(line);
            return {
              id: index,
              level: parsed.level || 'info',
              message: parsed.message || line,
              timestamp: parsed.timestamp || new Date().toISOString(),
              service: parsed.service || '8bp-rewards',
              action: parsed.action || 'unknown'
            };
          } catch {
            return {
              id: index,
              level: 'info',
              message: line,
              timestamp: new Date().toISOString(),
              service: '8bp-rewards',
              action: 'unknown'
            };
          }
        }).reverse(); // Most recent first
        }
      } catch (error) {
        logger.error('Failed to read log files', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    // Apply filters
    if (level) {
      logs = logs.filter(log => log.level === level);
    }
    if (service) {
      logs = logs.filter(log => log.service === service);
    }
    if (action) {
      logs = logs.filter(log => log.action === action);
    }

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedLogs = logs.slice(startIndex, endIndex);

    res.json({
      logs: paginatedLogs,
      pagination: {
        page,
        limit,
        total: logs.length,
        pages: Math.ceil(logs.length / limit)
      }
    });

  } catch (error) {
    logger.error('Failed to retrieve logs for admin', {
      action: 'admin_logs_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as AdminRequest).user?.id
    });

    res.status(500).json({
      error: 'Failed to retrieve logs'
    });
  }
});

// In-memory storage for progress tracking
const claimProgress = new Map<string, any>();

// Helper function to emit claim progress via WebSocket
function emitClaimProgressUpdate(processId: string, progress: any): void {
  if (!progress) return;
  
  try {
    const progressEvent = {
      processId: processId,
      status: progress.status || 'running',
      startTime: progress.startTime instanceof Date ? progress.startTime.toISOString() : (typeof progress.startTime === 'string' ? progress.startTime : new Date().toISOString()),
      endTime: progress.endTime instanceof Date ? progress.endTime.toISOString() : (progress.endTime || undefined),
      currentUser: progress.currentUser || null,
      totalUsers: progress.totalUsers || 0,
      completedUsers: progress.completedUsers || 0,
      failedUsers: progress.failedUsers || 0,
      userProgress: progress.userProgress || [],
      logs: (progress.logs || []).map((log: any) => ({
        level: log.type || log.level || 'info',
        message: log.message || log.toString(),
        timestamp: log.timestamp instanceof Date ? log.timestamp.toISOString() : (log.timestamp || new Date().toISOString())
      })),
      exitCode: progress.exitCode
    };
    
    WebSocketService.emitClaimProgress(processId, progressEvent);
  } catch (error) {
    logger.error('Failed to emit claim progress via WebSocket', {
      action: 'websocket_emit_error',
      processId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Manual claim for specific users (admin)
router.post('/claim-users', async (req, res): Promise<any> => {
  try {
    const { userIds } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        error: 'userIds array is required and must not be empty'
      });
    }

    logger.logAdminAction((req as AdminRequest).user?.id || 'unknown', 'manual_claim_users_trigger', {
      userIds,
      count: userIds.length,
      timestamp: new Date().toISOString()
    });

    // Trigger the claim script asynchronously with specific users
    const { spawn } = require('child_process');
    const claimProcess = spawn('node', ['playwright-claimer-discord.js'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ENABLE_PROGRESS_TRACKING: 'true',
        TARGET_USER_IDS: userIds.join(',') // Pass specific user IDs
      },
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const processId = claimProcess.pid?.toString() || Date.now().toString();
    
    // Initialize progress tracking
    const initialProgress = {
      status: 'starting',
      startTime: new Date(),
      currentUser: null,
      totalUsers: userIds.length,
      completedUsers: 0,
      failedUsers: 0,
      userProgress: [],
      logs: [],
      targetUsers: userIds
    };
    claimProgress.set(processId, initialProgress);
    emitClaimProgressUpdate(processId, initialProgress);

    // Log process output for debugging and progress tracking
    claimProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString().trim();
      logger.info('Targeted claim process output', {
        action: 'targeted_claim_process_output',
        output,
        pid: claimProcess.pid,
        targetUsers: userIds
      });

      // Parse progress updates from the claimer script
      const progress = claimProgress.get(processId);
      if (progress) {
        progress.logs.push({
          timestamp: new Date(),
          message: output,
          type: 'info'
        });

        // Parse specific progress indicators (same as claim-all)
        if (output.includes('🚀 Starting claim process for User ID:')) {
          const userIdMatch = output.match(/User ID: (\d+)/);
          if (userIdMatch) {
            progress.currentUser = userIdMatch[1];
            progress.userProgress.push({
              userId: userIdMatch[1],
              status: 'starting',
              startTime: new Date(),
              steps: []
            });
          }
        } else if (output.includes('✅ Claim process completed for user:')) {
          const userIdMatch = output.match(/Claim process completed for user: (\d+)/);
          if (userIdMatch) {
            const completedUserId = userIdMatch[1];
            
            const userProgressEntry = progress.userProgress.find((up: any) => up.userId === completedUserId);
            if (userProgressEntry && userProgressEntry.status !== 'completed') {
              userProgressEntry.status = 'completed';
              userProgressEntry.steps.push({ step: 'completed', timestamp: new Date() });
              progress.completedUsers++;
              
              const activeUsers = progress.userProgress.filter((up: any) => up.status === 'starting' || up.status === 'in_progress');
              if (activeUsers.length > 0) {
                progress.currentUser = activeUsers[0].userId;
              } else {
                progress.currentUser = 'All target users processed';
              }
            }
          }
        } else if (output.includes('⚠️ Failed to send Discord confirmation') || output.includes('Error claiming')) {
          const currentUserProgress = progress.userProgress[progress.userProgress.length - 1];
          if (currentUserProgress && currentUserProgress.status !== 'failed') {
            currentUserProgress.status = 'failed';
            currentUserProgress.steps.push({ step: 'failed', timestamp: new Date() });
            progress.failedUsers++;
            
            const activeUsers = progress.userProgress.filter((up: any) => up.status === 'starting' || up.status === 'in_progress');
            if (activeUsers.length > 0) {
              progress.currentUser = activeUsers[0].userId;
            } else {
              progress.currentUser = 'All target users processed';
            }
          }
        }

        claimProgress.set(processId, progress);
        emitClaimProgressUpdate(processId, progress);
      }
    });

    claimProcess.stderr.on('data', (data: Buffer) => {
      const error = data.toString().trim();
      logger.error('Targeted claim process error', {
        action: 'targeted_claim_process_error',
        error,
        pid: claimProcess.pid,
        targetUsers: userIds
      });

      const progress = claimProgress.get(processId);
      if (progress) {
        progress.logs.push({
          timestamp: new Date(),
          message: error,
          type: 'error'
        });
        claimProgress.set(processId, progress);
        emitClaimProgressUpdate(processId, progress);
      }
    });

    claimProcess.on('close', (code: number | null) => {
      logger.info('Targeted claim process completed', {
        action: 'targeted_claim_process_completed',
        exitCode: code,
        pid: claimProcess.pid,
        targetUsers: userIds
      });

      const progress = claimProgress.get(processId);
      if (progress) {
        progress.status = 'completed';
        progress.endTime = new Date();
        progress.exitCode = code;
        claimProgress.set(processId, progress);
        emitClaimProgressUpdate(processId, progress);
      }
    });

    // Detach the process so it runs independently
    claimProcess.unref();

    logger.info('Manual claim process started for specific users', {
      action: 'manual_claim_users_started',
      pid: claimProcess.pid,
      adminId: (req as AdminRequest).user?.id,
      targetUsers: userIds
    });

    res.json({
      message: `Manual claim process started for ${userIds.length} users`,
      pid: claimProcess.pid,
      processId,
      targetUsers: userIds,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to trigger manual claim for specific users', {
      action: 'admin_manual_claim_users_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as AdminRequest).user?.id
    });

    res.status(500).json({
      error: 'Failed to trigger manual claim for specific users'
    });
  }
});

// Manual claim trigger (admin) - keep existing functionality
router.post('/claim-all', async (req, res) => {
  try {
    logger.logAdminAction((req as AdminRequest).user?.id || 'unknown', 'manual_claim_trigger', {
      timestamp: new Date().toISOString()
    });

    // Trigger the claim script asynchronously
    const { spawn } = require('child_process');
    const claimProcess = spawn('node', ['playwright-claimer-discord.js'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ENABLE_PROGRESS_TRACKING: 'true'
      },
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const processId = claimProcess.pid?.toString() || Date.now().toString();
    
    // Initialize progress tracking
    const initialProgress = {
      status: 'starting',
      startTime: new Date(),
      currentUser: null,
      totalUsers: 0,
      completedUsers: 0,
      failedUsers: 0,
      userProgress: [],
      logs: []
    };
    claimProgress.set(processId, initialProgress);
    emitClaimProgressUpdate(processId, initialProgress);

    // Log process output for debugging and progress tracking
    claimProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString().trim();
      logger.info('Claim process output', {
        action: 'claim_process_output',
        output,
        pid: claimProcess.pid
      });

      // Parse progress updates from the claimer script
      const progress = claimProgress.get(processId);
      if (progress) {
        progress.logs.push({
          timestamp: new Date(),
          message: output,
          type: 'info'
        });

        // Parse specific progress indicators
        if (output.includes('🚀 Starting claim process for User ID:')) {
          const userIdMatch = output.match(/User ID: (\d+)/);
          if (userIdMatch) {
            progress.currentUser = userIdMatch[1];
            progress.userProgress.push({
              userId: userIdMatch[1],
              status: 'starting',
              startTime: new Date(),
              steps: []
            });
          }
        } else if (output.includes('🌐 Navigating to Daily Reward section')) {
          const currentUserProgress = progress.userProgress[progress.userProgress.length - 1];
          if (currentUserProgress && !currentUserProgress.steps.some((step: any) => step.step === 'navigating')) {
            currentUserProgress.steps.push({ step: 'navigating', timestamp: new Date() });
          }
        } else if (output.includes('✅ Login modal appeared')) {
          const currentUserProgress = progress.userProgress[progress.userProgress.length - 1];
          if (currentUserProgress && !currentUserProgress.steps.some((step: any) => step.step === 'login_modal')) {
            currentUserProgress.steps.push({ step: 'login_modal', timestamp: new Date() });
          }
        } else if (output.includes('✅ Successfully loaded Daily Reward page')) {
          const currentUserProgress = progress.userProgress[progress.userProgress.length - 1];
          if (currentUserProgress && !currentUserProgress.steps.some((step: any) => step.step === 'logged_in')) {
            currentUserProgress.steps.push({ step: 'logged_in', timestamp: new Date() });
            // Mark as in progress once they're logged in
            if (currentUserProgress.status === 'starting') {
              currentUserProgress.status = 'in_progress';
            }
          }
        } else if (output.includes('✅ Entered User ID:')) {
          const currentUserProgress = progress.userProgress[progress.userProgress.length - 1];
          if (currentUserProgress && !currentUserProgress.steps.some((step: any) => step.step === 'entering_id')) {
            currentUserProgress.steps.push({ step: 'entering_id', timestamp: new Date() });
          }
        } else if (output.includes('✅ Clicked') && output.includes('Go button')) {
          const currentUserProgress = progress.userProgress[progress.userProgress.length - 1];
          if (currentUserProgress && !currentUserProgress.steps.some((step: any) => step.step === 'go_clicked')) {
            currentUserProgress.steps.push({ step: 'go_clicked', timestamp: new Date() });
          }
        } else if (output.includes('✅ Successfully clicked FREE button')) {
          const currentUserProgress = progress.userProgress[progress.userProgress.length - 1];
          if (currentUserProgress) {
            // Allow multiple FREE button clicks (multiple items can be claimed)
            currentUserProgress.steps.push({ step: 'item_claimed', timestamp: new Date() });
          }
        } else if (output.includes('⚠️ Button text changed to') && output.includes('already claimed')) {
          const currentUserProgress = progress.userProgress[progress.userProgress.length - 1];
          if (currentUserProgress) {
            // Allow multiple already-claimed items
            currentUserProgress.steps.push({ step: 'item_already_claimed', timestamp: new Date() });
          }
        } else if (output.includes('✅ Claim process completed for user:')) {
          const userIdMatch = output.match(/Claim process completed for user: (\d+)/);
          if (userIdMatch) {
            const completedUserId = userIdMatch[1];
            
            // Find the user progress entry for this specific user
            const userProgressEntry = progress.userProgress.find((up: any) => up.userId === completedUserId);
            if (userProgressEntry && userProgressEntry.status !== 'completed') {
              userProgressEntry.status = 'completed';
              userProgressEntry.steps.push({ step: 'completed', timestamp: new Date() });
              progress.completedUsers++;
              
              // Update currentUser to show the next active user or processing status
              const activeUsers = progress.userProgress.filter((up: any) => up.status === 'starting' || up.status === 'in_progress');
              if (activeUsers.length > 0) {
                // Show the first active user
                progress.currentUser = activeUsers[0].userId;
              } else {
                // Check if there are more users to process
                const totalProcessed = progress.userProgress.length;
                if (totalProcessed < progress.totalUsers) {
                  progress.currentUser = 'Processing next user...';
                } else {
                  progress.currentUser = 'All users processed';
                }
              }
            }
          }
        } else if (output.includes('⚠️ Failed to send Discord confirmation') || output.includes('Error claiming')) {
          // Find the most recent user progress entry that's not completed
          const currentUserProgress = progress.userProgress[progress.userProgress.length - 1];
          if (currentUserProgress && currentUserProgress.status !== 'failed') {
            currentUserProgress.status = 'failed';
            currentUserProgress.steps.push({ step: 'failed', timestamp: new Date() });
            progress.failedUsers++;
            
            // Update currentUser to show the next active user or processing status
            const activeUsers = progress.userProgress.filter((up: any) => up.status === 'starting' || up.status === 'in_progress');
            if (activeUsers.length > 0) {
              // Show the first active user
              progress.currentUser = activeUsers[0].userId;
            } else {
              // Check if there are more users to process
              const totalProcessed = progress.userProgress.length;
              if (totalProcessed < progress.totalUsers) {
                progress.currentUser = 'Processing next user...';
              } else {
                progress.currentUser = 'All users processed';
              }
            }
          }
        } else if (output.includes('📊 Found') && output.includes('users in database')) {
          const userCountMatch = output.match(/Found (\d+) users/);
          if (userCountMatch) {
            progress.totalUsers = parseInt(userCountMatch[1]);
          }
        }

        claimProgress.set(processId, progress);
        emitClaimProgressUpdate(processId, progress);
      }
    });

    claimProcess.stderr.on('data', (data: Buffer) => {
      const error = data.toString().trim();
      logger.error('Claim process error', {
        action: 'claim_process_error',
        error,
        pid: claimProcess.pid
      });

      const progress = claimProgress.get(processId);
      if (progress) {
        progress.logs.push({
          timestamp: new Date(),
          message: error,
          type: 'error'
        });
        claimProgress.set(processId, progress);
        emitClaimProgressUpdate(processId, progress);
      }
    });

    claimProcess.on('close', (code: number | null) => {
      logger.info('Claim process completed', {
        action: 'claim_process_completed',
        exitCode: code,
        pid: claimProcess.pid
      });

      const progress = claimProgress.get(processId);
      if (progress) {
        progress.status = 'completed';
        progress.endTime = new Date();
        progress.exitCode = code;
        claimProgress.set(processId, progress);
        emitClaimProgressUpdate(processId, progress);
      }
    });

    // Detach the process so it runs independently
    claimProcess.unref();

    logger.info('Manual claim process started', {
      action: 'manual_claim_started',
      pid: claimProcess.pid,
      adminId: (req as AdminRequest).user?.id
    });

    res.json({
      message: 'Manual claim process started',
      pid: claimProcess.pid,
      processId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to trigger manual claim', {
      action: 'admin_manual_claim_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as AdminRequest).user?.id
    });

    res.status(500).json({
      error: 'Failed to trigger manual claim'
    });
  }
});

// Get claim progress
router.get('/claim-progress/:processId', async (req, res) => {
  try {
    const { processId } = req.params;
    const progress = claimProgress.get(processId);
    
    if (!progress) {
      return res.status(404).json({
        error: 'Process not found'
      });
    }

    return res.json(progress);
  } catch (error) {
    logger.error('Failed to get claim progress', {
      action: 'get_claim_progress_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return res.status(500).json({
      error: 'Failed to get claim progress'
    });
  }
});

// Clear old progress data (older than 1 hour)
router.delete('/claim-progress/cleanup', async (req, res) => {
  try {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    let cleanedCount = 0;
    
    for (const [processId, progress] of claimProgress.entries()) {
      if (progress.startTime && progress.startTime.getTime() < oneHourAgo) {
        claimProgress.delete(processId);
        cleanedCount++;
      }
    }

    return res.json({ 
      message: `Cleaned up ${cleanedCount} old progress entries`,
      remainingProcesses: claimProgress.size 
    });
  } catch (error) {
    logger.error('Failed to cleanup progress data', {
      action: 'cleanup_progress_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return res.status(500).json({
      error: 'Failed to cleanup progress data'
    });
  }
});

// Get all active claim processes
router.get('/claim-progress', async (req, res) => {
  try {
    const allProgress = Array.from(claimProgress.entries()).map(([processId, progress]) => ({
      processId,
      ...progress
    }));

    return res.json(allProgress);
  } catch (error) {
    logger.error('Failed to get all claim progress', {
      action: 'get_all_claim_progress_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return res.status(500).json({
      error: 'Failed to get claim progress'
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
      const stats = await dbService.getClaimStats(days);
      totals[timeframe] = stats;
    }

    res.json(totals);

  } catch (error) {
    logger.error('Failed to retrieve claim totals', {
      action: 'admin_claim_totals_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as AdminRequest).user?.id
    });

    res.status(500).json({
      error: 'Failed to retrieve claim totals'
    });
  }
});

// Search functionality
router.get('/search', async (req, res): Promise<void> => {
  try {
    const query = req.query.q as string || req.query.query as string;
    const type = req.query.type as string || 'all';

    if (!query) {
      res.status(400).json({
        error: 'Search query is required'
      });
      return;
    }

    const results: any = {};

    if (type === 'all' || type === 'registrations') {
      // Get all registrations and filter in memory for PostgreSQL compatibility
      const allRegistrations = await dbService.findRegistrations();
      const registrations = allRegistrations.filter(reg => 
        reg.eightBallPoolId.includes(query) || 
        reg.username.toLowerCase().includes(query.toLowerCase())
      );

      results.registrations = registrations;
    }

    if (type === 'all' || type === 'claims') {
      // Get all claims and filter in memory for PostgreSQL compatibility
      const allClaims = await dbService.findClaimRecords();
      const claims = allClaims.filter(claim => 
        claim.eightBallPoolId.includes(query) ||
        (claim.itemsClaimed && claim.itemsClaimed.some((item: string) => 
          item.toLowerCase().includes(query.toLowerCase())
        ))
      );

      results.claims = claims;
    }

    if (type === 'all' || type === 'logs') {
      // Logs functionality disabled for PostgreSQL migration
      results.logs = [];
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
      adminId: (req as AdminRequest).user?.id,
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

    logger.logAdminAction((req as AdminRequest).user?.id || 'unknown', 'toggle_notifications', {
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
      adminId: (req as AdminRequest).user?.id
    });

    res.status(500).json({
      error: 'Failed to update notification settings'
    });
  }
});

// Block/Unblock user
router.post('/users/:eightBallPoolId/block', async (req, res): Promise<void> => {
  try {
    const { eightBallPoolId } = req.params;
    const { isBlocked, reason } = req.body;

    const registration = await dbService.findRegistration({ eightBallPoolId });
    
    if (!registration) {
      res.status(404).json({ error: 'Registration not found' });
      return;
    }

    await dbService.updateRegistration(eightBallPoolId, {
      isBlocked,
      blockedReason: isBlocked ? reason : undefined
    });

    if (isBlocked) {
      // Enhanced blocking with device tracking
      const deviceInfo = deviceDetectionService.extractDeviceInfo(req);
      const clientIP = req.ip || 
                       req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
                       req.headers['x-real-ip']?.toString() ||
                       req.headers['cf-connecting-ip']?.toString() ||
                       req.connection?.remoteAddress ||
                       req.socket?.remoteAddress ||
                       'Admin Dashboard';

      // Block all devices associated with this user
      const adminId = (req as AdminRequest).user?.id || 'admin';
      const blockedDevices = await blockingService.blockUserByEightBallPoolId(
        eightBallPoolId,
        adminId,
        reason || 'Blocked by admin'
      );

      logger.info('User blocked with device tracking', {
        action: 'enhanced_user_blocked',
        eightBallPoolId,
        username: registration.username,
        blockedDevicesCount: blockedDevices.length,
        adminId: (req as AdminRequest).user?.id,
        reason
      });
    } else {
      // Unblock user (remove from blocked_devices table)
      const blockedDevices = await blockingService.getBlockedDevices(1000, 0);
      const userBlockedDevices = blockedDevices.filter(
        device => device.eightBallPoolId === eightBallPoolId && device.isActive
      );

      for (const blockedDevice of userBlockedDevices) {
        await blockingService.unblockDevice(blockedDevice.id, (req.user as any)?.id || 'admin');
      }

      logger.info('User unblocked with device tracking', {
        action: 'enhanced_user_unblocked',
        eightBallPoolId,
        username: registration.username,
        unblockedDevicesCount: userBlockedDevices.length,
        adminId: (req as AdminRequest).user?.id
      });
    }

    logger.logAdminAction((req as AdminRequest).user?.id || 'unknown', isBlocked ? 'block_user' : 'unblock_user', {
      eightBallPoolId,
      username: registration.username,
      reason
    });

    res.json({
      message: isBlocked ? 'User blocked successfully with device tracking' : 'User unblocked successfully',
      user: {
        eightBallPoolId: registration.eightBallPoolId,
        username: registration.username,
        isBlocked: registration.isBlocked,
        deviceId: registration.deviceId,
        deviceType: registration.deviceType,
        registrationIp: registration.registrationIp,
        blockedReason: registration.blockedReason
      }
    });

  } catch (error) {
    logger.error('Failed to block/unblock user', {
      action: 'admin_block_user_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as AdminRequest).user?.id
    });

    res.status(500).json({
      error: 'Failed to block/unblock user'
    });
  }
});

// Get blocked devices
router.get('/blocked-devices', authenticateAdmin, async (req, res): Promise<void> => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const blockedDevices = await blockingService.getBlockedDevices(
      parseInt(limit as string),
      parseInt(offset as string)
    );
    
    const totalCount = await blockingService.getBlockedDevicesCount();
    
    res.json({
      blockedDevices,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit as string))
      }
    });
    
  } catch (error) {
    logger.error('Failed to get blocked devices', {
      action: 'get_blocked_devices_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as AdminRequest).user?.id
    });
    
    res.status(500).json({
      error: 'Failed to get blocked devices'
    });
  }
});

// Unblock a specific device
router.post('/blocked-devices/:deviceId/unblock', authenticateAdmin, async (req, res): Promise<void> => {
  try {
    const { deviceId } = req.params;
    
    const success = await blockingService.unblockDevice(deviceId, (req.user as any)?.id || 'admin');
    
    if (success) {
      res.json({
        message: 'Device unblocked successfully'
      });
    } else {
      res.status(404).json({
        error: 'Blocked device not found'
      });
    }
    
  } catch (error) {
    logger.error('Failed to unblock device', {
      action: 'unblock_device_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      deviceId: req.params.deviceId,
      adminId: (req as AdminRequest).user?.id
    });
    
    res.status(500).json({
      error: 'Failed to unblock device'
    });
  }
});

// VPS Monitor Multi-Channel Authentication System
// Codes and access are now stored in the database via DatabaseService
// Cleanup runs via DatabaseService.cleanupExpiredVPSCodes() (should be scheduled via cron)

// Generate 16-character random code
function generateVPSCode(): string {
  return crypto.randomBytes(8).toString('hex').toUpperCase();
}

// Generate 6-digit PIN for email
function generate6DigitPin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Permission functions moved to utils/permissions.ts

// Request VPS access codes (Discord or Telegram)
router.post('/vps/request-access', async (req, res) => {
  try {
    const user = req.user as any;
    const userId = user?.id;
    const username = user?.username;
    const { channel, email } = req.body; // 'discord', 'telegram', or undefined for both, plus optional email

    // Debug logging (can be removed in production)
    logger.debug('VPS request access debug', {
      action: 'vps_request_debug',
      hasUser: !!user,
      userId,
      username,
      channel,
      userEmail: user?.email,
      providedEmail: email
    });

    // Check if user is authenticated
    if (!user || !userId) {
      return res.status(401).json({
        error: 'Authentication required. Please log in through Discord.'
      });
    }

    // Check if user is allowed VPS access
    if (!isAllowedForVPS(userId)) {
      return res.status(403).json({
        error: 'Access denied. You are not authorised to access VPS Monitor.'
      });
    }

    // Get or create codes for this user from database
    let vpsCodeData = await dbService.getVPSCode(userId);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    let discordCode: string;
    let telegramCode: string;
    let emailCode: string;
    let discordMessageId: string | undefined;
    let telegramMessageId: string | undefined;

    if (!vpsCodeData || vpsCodeData.isUsed) {
      // Generate new codes
      discordCode = generateVPSCode();
      telegramCode = generateVPSCode();
      emailCode = generate6DigitPin();
    } else {
      // Reuse existing codes
      discordCode = vpsCodeData.discordCode;
      telegramCode = vpsCodeData.telegramCode;
      emailCode = vpsCodeData.emailCode || generate6DigitPin();
      discordMessageId = vpsCodeData.discordMessageId;
      telegramMessageId = vpsCodeData.telegramMessageId;
    }
    
    // Store codes in database
    await dbService.storeVPSCode({
      userId,
      discordCode,
      telegramCode,
      emailCode,
      userEmail: email || user.email || '',
      username,
      expiresAt,
      discordMessageId,
      telegramMessageId
    });

    let discordSent = false;
    let telegramSent = false;
    let emailSent = false;

    // Send Discord code if requested
    if (!channel || channel === 'discord') {
      try {
        const discordService = new DiscordNotificationService();
        const discordMessage = await discordService.sendDirectMessage(
          userId,
          `🔐 **VPS Monitor Access Code (Discord)**\n\n` +
          `Your Discord access code is: **${discordCode}**\n` +
          `This code expires in 5 minutes.\n\n` +
          `⚠️ **Security Notice**: This code is required for VPS Monitor access.`
        );

        discordSent = discordMessage !== null && discordMessage !== undefined;
        
        logger.info('Discord code sending attempt', {
          action: 'discord_code_send_attempt',
          userId,
          username,
          discordSent,
          hasMessage: !!discordMessage,
          messageId: discordMessage?.id
        });
        
        // Store Discord message ID for cleanup
        if (discordMessage && discordMessage.id) {
          discordMessageId = discordMessage.id;
          // Update in database
          await dbService.storeVPSCode({
            userId,
            discordCode,
            telegramCode,
            emailCode,
            userEmail: email || user.email || '',
            username,
            expiresAt,
            discordMessageId: discordMessage.id,
            telegramMessageId
          });
        }

      } catch (discordError) {
        logger.error('Failed to send Discord DM', {
          action: 'discord_dm_error',
          userId,
          username,
          error: discordError instanceof Error ? discordError.message : 'Unknown error',
          stack: discordError instanceof Error ? discordError.stack : undefined,
          hasToken: !!process.env.DISCORD_TOKEN
        });
        discordSent = false;
      }
    }

    // Send Telegram code if requested and allowed - only to the logged-in user
    if ((!channel || channel === 'telegram') && isAllowedForTelegram(userId) && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN !== 'your_telegram_bot_token_here') {
      try {
        const telegramService = new TelegramNotificationService();
        
        // Map Discord user ID to Telegram user ID for the logged-in user only
        // Read mapping from environment variable: DISCORD_TO_TELEGRAM_MAPPING=discord_id1:telegram_id1,discord_id2:telegram_id2
        const mappingEnv = process.env.DISCORD_TO_TELEGRAM_MAPPING || '';
        const userMapping: Record<string, string> = {};
        
        if (mappingEnv) {
          mappingEnv.split(',').forEach(mapping => {
            const [discordId, telegramId] = mapping.trim().split(':');
            if (discordId && telegramId) {
              userMapping[discordId] = telegramId;
            }
          });
        }
        
        const telegramUserId = userMapping[userId];
        
        if (telegramUserId) {
          const telegramMessage = await telegramService.sendDirectMessage(
            telegramUserId,
            `🔐 *VPS Monitor Access Code (Telegram)*\n\n` +
            `Your Telegram access code is: *${telegramCode}*\n` +
            `This code expires in 5 minutes.\n\n` +
            `⚠️ *Security Notice*: This code is required for VPS Monitor access.`
          );

          telegramSent = telegramMessage !== null;
          
          // Store Telegram message ID for cleanup
          if (telegramMessage && telegramMessage.id) {
            telegramMessageId = telegramMessage.id;
            // Update in database
            await dbService.storeVPSCode({
              userId,
              discordCode,
              telegramCode,
              emailCode,
              userEmail: email || user.email || '',
              username,
              expiresAt,
              discordMessageId,
              telegramMessageId: telegramMessage.id
            });
          }
        } else {
          logger.warn('No Telegram mapping found for Discord user', {
            action: 'telegram_mapping_not_found',
            userId,
            username,
            hasMapping: !!process.env.DISCORD_TO_TELEGRAM_MAPPING
          });
        }

      } catch (telegramError) {
        logger.error('Failed to send Telegram DM', {
          action: 'telegram_dm_error',
          userId,
          username,
          error: telegramError instanceof Error ? telegramError.message : 'Unknown error'
        });
        logger.warn('Telegram bot not working', {
          action: 'telegram_error',
          userId,
          username,
          error: telegramError instanceof Error ? telegramError.message : 'Unknown error'
        });
      }
    } else if (!channel || channel === 'telegram') {
      logger.warn('User not allowed for Telegram access or bot not configured', {
        action: 'telegram_access_denied',
        userId,
        username,
        reason: !isAllowedForTelegram(userId) ? 'user_not_allowed' : 'bot_not_configured'
      });
    }

    // Send Email code if requested
    // Use email from ADMIN_EMAILS mapped to Discord user ID, not from Discord OAuth profile
    const allowedEmails = process.env.ADMIN_EMAILS?.split(',').map((e: string) => e.trim()) || [];
    let vpsUserEmail = email || '';
    
    // If no email provided, try to map Discord user ID to email from DISCORD_TO_EMAIL_MAPPING
    // Format: DISCORD_TO_EMAIL_MAPPING=discord_id1:email1,discord_id2:email2
    if (!vpsUserEmail) {
      const emailMappingEnv = process.env.DISCORD_TO_EMAIL_MAPPING || '';
      const emailMapping: Record<string, string> = {};
      
      if (emailMappingEnv) {
        emailMappingEnv.split(',').forEach(mapping => {
          const [discordId, emailAddr] = mapping.trim().split(':');
          if (discordId && emailAddr) {
            emailMapping[discordId.trim()] = emailAddr.trim();
          }
        });
      }
      
      // Check if there's a mapping for this user
      if (emailMapping[userId]) {
        vpsUserEmail = emailMapping[userId];
        logger.info('Email mapped from DISCORD_TO_EMAIL_MAPPING', {
          action: 'email_mapped_from_config',
          userId,
          username,
          mappedEmail: vpsUserEmail
        });
      } else if (allowedEmails.length === 1) {
        // Fallback: if only one email configured, use it
        vpsUserEmail = allowedEmails[0];
        logger.info('No email mapping found, using single email from ADMIN_EMAILS', {
          action: 'email_auto_selected',
          userId,
          username,
          selectedEmail: vpsUserEmail
        });
      }
    }
    
    // Log email request attempt
    logger.info('Email code request attempt', {
      action: 'email_code_request_attempt',
      userId,
      username,
      channel,
      hasEmailParam: !!email,
      vpsUserEmail: vpsUserEmail || 'MISSING',
      allowedEmails: allowedEmails.map(e => e.toLowerCase()),
      adminEmailsCount: allowedEmails.length
    });
    
    if (channel === 'email' && !vpsUserEmail) {
      logger.error('Email code requested but no email provided', {
        action: 'email_code_no_email',
        userId,
        username,
        hasEmailParam: !!email,
        adminEmailsCount: allowedEmails.length,
        adminEmails: allowedEmails
      });
      
      if (allowedEmails.length === 0) {
        return res.status(400).json({
          error: 'Email authentication is not configured. No admin emails found in ADMIN_EMAILS.',
          details: 'Please configure ADMIN_EMAILS in your environment variables.'
        });
      } else if (allowedEmails.length > 1) {
        // Check if DISCORD_TO_EMAIL_MAPPING is configured
        const emailMappingEnv = process.env.DISCORD_TO_EMAIL_MAPPING || '';
        if (!emailMappingEnv) {
          return res.status(400).json({
            error: 'Email address is required. Multiple admin emails are configured but DISCORD_TO_EMAIL_MAPPING is not set.',
            details: `Please configure DISCORD_TO_EMAIL_MAPPING in your .env file. Format: DISCORD_TO_EMAIL_MAPPING=discord_id1:email1,discord_id2:email2`,
            availableEmails: allowedEmails
          });
        }
        // If mapping exists but user not found, return specific error
        return res.status(400).json({
          error: 'Email address is required. Your Discord user ID is not mapped to an email in DISCORD_TO_EMAIL_MAPPING.',
          details: `Please contact an administrator to add your Discord ID (${userId}) to DISCORD_TO_EMAIL_MAPPING.`,
          userId,
          availableEmails: allowedEmails
        });
      } else {
        return res.status(400).json({
          error: 'Email address is required for email authentication.',
          details: 'Please provide your email address.'
        });
      }
    }
    
    if ((!channel || channel === 'email') && vpsUserEmail) {
      // Check if user's email is in the allowed list
      if (!isAllowedForEmail(vpsUserEmail)) {
        logger.warn('Email not in ADMIN_EMAILS whitelist', {
          action: 'email_not_whitelisted',
          userId,
          username,
          email: vpsUserEmail,
          allowedEmails: process.env.ADMIN_EMAILS?.split(',').map((e: string) => e.trim().toLowerCase()) || []
        });
        
        if (channel === 'email') {
          return res.status(403).json({
            error: 'Your email is not authorised for email authentication. Please contact an administrator or use Discord/Telegram authentication.'
          });
        }
        emailSent = false;
      } else {
        try {
          const emailService = new EmailNotificationService();
          
          if (emailService.isConfigured()) {
            logger.info('Attempting to send email code', {
              action: 'email_send_attempt',
              userId,
              username,
              email: vpsUserEmail,
              smtpHost: process.env.SMTP_HOST
            });
            
            emailSent = await emailService.sendPinCode(
              vpsUserEmail,
              emailCode,
              'VPS Monitor Access'
            );
            
            // Update the database with the email address used
            if (emailSent && vpsUserEmail) {
              await dbService.storeVPSCode({
                userId,
                discordCode,
                telegramCode,
                emailCode,
                userEmail: vpsUserEmail,
                username,
                expiresAt,
                discordMessageId,
                telegramMessageId
              });
            }
            
            if (emailSent) {
              logger.info('VPS access email code sent successfully', {
                action: 'vps_email_sent',
                userId,
                username,
                email: vpsUserEmail
              });
            } else {
              logger.warn('Email service returned false (email not sent)', {
                action: 'email_send_returned_false',
                userId,
                username,
                email: vpsUserEmail
              });
            }
          } else {
            logger.warn('Email service not configured', {
              action: 'email_not_configured',
              userId,
              username,
              hasHost: !!process.env.SMTP_HOST,
              hasUser: !!process.env.SMTP_USER,
              hasPass: !!process.env.SMTP_PASS,
              hasFrom: !!process.env.MAIL_FROM
            });
            emailSent = false;
          }
        } catch (emailError) {
          logger.error('Failed to send email - exception thrown', {
            action: 'email_send_error',
            userId,
            username,
            email: vpsUserEmail,
            error: emailError instanceof Error ? emailError.message : 'Unknown error',
            stack: emailError instanceof Error ? emailError.stack : undefined,
            smtpConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
            errorType: emailError?.constructor?.name || 'Unknown'
          });
          emailSent = false;
        }
      }
    } else if (channel === 'email') {
      // Channel is email but no email available
      emailSent = false;
    }

    // Check if the requested channel succeeded
    if (channel === 'discord' && !discordSent) {
      logger.error('Discord code sending failed for user', {
        action: 'discord_code_send_failed',
        userId,
        username,
        channel,
        hasToken: !!process.env.DISCORD_TOKEN
      });
      return res.status(500).json({
        error: 'Failed to send Discord access code. Please check logs and try again.',
        details: 'Discord DM failed to send. Check backend logs for details.'
      });
    }
    
    if (channel === 'telegram' && !telegramSent) {
      return res.status(500).json({
        error: 'Failed to send Telegram access code. Please try again.'
      });
    }
    
    if (channel === 'email' && !emailSent) {
      logger.error('Email code sending failed - returning error', {
        action: 'email_code_final_check_failed',
        userId,
        username,
        vpsUserEmail: vpsUserEmail || 'MISSING',
        hasEmail: !!vpsUserEmail,
        emailAllowed: vpsUserEmail ? isAllowedForEmail(vpsUserEmail) : false
      });
      
      // Provide more specific error message
      let errorMessage = 'Failed to send email access code.';
      if (!vpsUserEmail) {
        errorMessage = 'Email address is required but not found. Please provide your email.';
      } else if (!isAllowedForEmail(vpsUserEmail)) {
        errorMessage = 'Your email is not authorised for email authentication.';
      } else {
        errorMessage = 'Failed to send email access code. Please check your email configuration and try again.';
      }
      
      return res.status(500).json({
        error: errorMessage,
        details: vpsUserEmail ? `Attempted to send to: ${vpsUserEmail}` : 'No email address available'
      });
    }

    logger.logAdminAction(userId, 'vps_access_requested', {
      username,
      channel: channel || 'all',
      discordCodeGenerated: discordSent,
      telegramCodeGenerated: telegramSent,
      emailCodeGenerated: emailSent
    });

    return res.json({
      message: channel === 'discord' ? 'Discord access code sent!' : 
               channel === 'telegram' ? 'Telegram access code sent!' : 
               channel === 'email' ? 'Email access code sent!' :
               `Access codes sent to: ${[discordSent && 'Discord', telegramSent && 'Telegram', emailSent && 'Email'].filter(Boolean).join(', ')}`,
      discordSent,
      telegramSent,
      emailSent,
      userEmail: email || user.email || null,
      expiresIn: 5 * 60 * 1000 // 5 minutes in milliseconds
    });

  } catch (error) {
    logger.error('VPS access request error', {
      action: 'vps_access_request_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: (req.user as any)?.id,
      username: (req.user as any)?.username
    });
    return res.status(500).json({
      error: 'Failed to process access request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Verify VPS access codes (Discord + Telegram OR Email)
router.post('/vps/verify-access', async (req, res) => {
  try {
    const { discordCode, telegramCode, emailCode } = req.body;
    const user = req.user as any;
    const userId = user.id;

    // User must provide either (Discord + Telegram) OR (Email)
    const hasDiscordTelegram = discordCode && (telegramCode || !isAllowedForTelegram(userId));
    const hasEmail = emailCode;

    if (!hasDiscordTelegram && !hasEmail) {
      return res.status(400).json({
        error: 'Please provide either Discord code (and Telegram if applicable) OR email code'
      });
    }

    // Find the codes for this user from database
    const vpsCodeData = await dbService.getVPSCode(userId);
    
    if (!vpsCodeData) {
      return res.status(400).json({
        error: 'No access codes found. Please request access first.'
      });
    }

    // Check if codes are expired
    if (vpsCodeData.expiresAt < new Date()) {
      await dbService.deleteVPSCode(userId);
      return res.status(400).json({
        error: 'Access codes have expired. Please request new codes.'
      });
    }

    // Check if codes are already used
    if (vpsCodeData.isUsed) {
      return res.status(400).json({
        error: 'Access codes have already been used'
      });
    }

    let verificationMethod = '';

    // Verify Email code if provided
    if (hasEmail && !hasDiscordTelegram) {
      if (vpsCodeData.emailCode !== emailCode.trim()) {
        await dbService.incrementVPSCodeAttempts(userId);
        return res.status(400).json({
          error: 'Invalid email access code.'
        });
      }
      verificationMethod = 'email';
    }
    // Verify Discord + Telegram codes if provided
    else if (hasDiscordTelegram) {
      // Verify Discord code
      if (vpsCodeData.discordCode !== discordCode.toUpperCase()) {
        await dbService.incrementVPSCodeAttempts(userId);
        return res.status(400).json({
          error: 'Invalid Discord access code.'
        });
      }

      // Verify Telegram code (only if user is allowed for Telegram)
      if (isAllowedForTelegram(userId)) {
        if (vpsCodeData.telegramCode !== telegramCode.toUpperCase()) {
          await dbService.incrementVPSCodeAttempts(userId);
          return res.status(400).json({
            error: 'Invalid Telegram access code.'
          });
        }
        verificationMethod = 'discord+telegram';
      } else {
        // If user is not allowed for Telegram, they should not have a Telegram code
        if (telegramCode && telegramCode.trim()) {
          await dbService.incrementVPSCodeAttempts(userId);
          return res.status(400).json({
            error: 'You are not authorised to use Telegram authentication.'
          });
        }
        verificationMethod = 'discord';
      }
    }

    // Mark codes as used in database
    await dbService.markVPSCodeAsUsed(userId);

    // Send approval messages and schedule cleanup
    try {
      // Send approval based on verification method
      if (verificationMethod === 'email') {
        // Send email approval
        const emailService = new EmailNotificationService();
        if (emailService.isConfigured() && vpsCodeData.userEmail) {
          await emailService.sendPinCode(
            vpsCodeData.userEmail,
            '✅ ACCESS GRANTED',
            'VPS Monitor Access Approved'
          );
        }

        logger.logAdminAction(userId, 'vps_access_granted', {
          username: vpsCodeData.username,
          verificationMethod: 'email',
          emailUsed: vpsCodeData.userEmail
        });
      } else {
        // Send Discord/Telegram approval messages
        const discordService = new DiscordNotificationService();
        const telegramService = new TelegramNotificationService();
        
        // Delete the original code messages
        if (vpsCodeData.discordMessageId) {
          try {
            await discordService.deleteMessage(userId, vpsCodeData.discordMessageId);
          } catch (deleteError) {
            logger.error('Failed to delete Discord code message', {
              action: 'delete_discord_message_error',
              userId,
              error: deleteError instanceof Error ? deleteError.message : 'Unknown error'
            });
          }
        }

        if (vpsCodeData.telegramMessageId) {
          try {
            await telegramService.deleteMessage(userId, vpsCodeData.telegramMessageId);
          } catch (deleteError) {
            logger.error('Failed to delete Telegram code message', {
              action: 'delete_telegram_message_error',
              userId,
              error: deleteError instanceof Error ? deleteError.message : 'Unknown error'
            });
          }
        }

        // Send approval messages
        const authMethod = verificationMethod === 'discord+telegram' ? 
          'Both Discord and Telegram codes verified successfully.' :
          'Discord code verified successfully.';
        
        const discordApproval = await discordService.sendDirectMessage(
          userId,
          `✅ **VPS Monitor Access Approved**\n\n` +
          `You now have access to the VPS Monitor for this session.\n` +
          `${authMethod}\n` +
          `This message will be automatically deleted in 24 hours.`
        );

        if (verificationMethod === 'discord+telegram') {
          const telegramApproval = await telegramService.sendDirectMessage(
            userId,
            `✅ *VPS Monitor Access Approved*\n\n` +
            `You now have access to the VPS Monitor for this session.\n` +
            `${authMethod}\n` +
            `This message will be automatically deleted in 24 hours.`
          );

          // Schedule approval message deletion after 24 hours
          if (telegramApproval && telegramApproval.id) {
            setTimeout(async () => {
              try {
                await telegramService.deleteMessage(userId, telegramApproval.id!);
              } catch (deleteError) {
                logger.error('Failed to delete Telegram approval message', {
                  action: 'delete_telegram_message_error',
                  error: deleteError instanceof Error ? deleteError.message : 'Unknown error'
                });
              }
            }, 24 * 60 * 60 * 1000); // 24 hours
          }
        }

        // Schedule approval message deletion after 24 hours
        if (discordApproval && discordApproval.id) {
          setTimeout(async () => {
            try {
              await discordService.deleteMessage(userId, discordApproval.id!);
            } catch (deleteError) {
              logger.error('Failed to delete Discord approval message', {
                action: 'delete_discord_message_error',
                error: deleteError instanceof Error ? deleteError.message : 'Unknown error'
              });
            }
          }, 24 * 60 * 60 * 1000); // 24 hours
        }

        logger.logAdminAction(userId, 'vps_access_granted', {
          username: vpsCodeData.username,
          verificationMethod,
          discordCodeUsed: discordCode,
          telegramCodeUsed: telegramCode
        });
      }

      // Grant access (store in database)
      const accessExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      await dbService.storeVPSAccess({
        userId,
        expiresAt: accessExpiresAt
      });

      // Clean up the codes from database (already marked as used)
      await dbService.deleteVPSCode(userId);

      return res.json({
        message: `Access granted - ${verificationMethod === 'email' ? 'email code' : 'codes'} verified successfully`,
        accessToken: crypto.randomBytes(32).toString('hex') // Simple session token
      });

    } catch (approvalError) {
      logger.error('Failed to send approval messages', {
        action: 'approval_messages_error',
        error: approvalError instanceof Error ? approvalError.message : 'Unknown error'
      });
      return res.status(500).json({
        error: 'Access granted but failed to send confirmation messages'
      });
    }

  } catch (error) {
    logger.error('VPS access verification error', {
      action: 'vps_access_verification_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return res.status(500).json({
      error: 'Failed to verify access codes'
    });
  }
});

// Check VPS access status
router.get('/vps/access-status', async (req, res) => {
  try {
    const user = req.user as any;
    const userId = user.id;

    // Check if user is allowed VPS access
    const isAllowed = isAllowedForVPS(userId);
    
    // Check if user has active codes from database
    const userVpsCode = await dbService.getVPSCode(userId);
    const hasActiveCodes = userVpsCode && !userVpsCode.isUsed && userVpsCode.expiresAt > new Date();
    
    res.json({
      isAllowed,
      hasActiveCodes,
      dualChannelAuth: true
    });

  } catch (error) {
    logger.error('VPS access status error', {
      action: 'vps_access_status_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      error: 'Failed to check access status'
    });
  }
});

// Test Discord bot functionality (development only)
router.post('/vps/test-discord', async (req, res) => {
  try {
    const user = req.user as any;
    const userId = user.id;

    if (!isAllowedForVPS(userId)) {
      return res.status(403).json({
        error: 'Access denied. You are not authorised to access VPS Monitor.'
      });
    }

    // Test Discord DM
    const discordService = new DiscordNotificationService();
    const testMessage = `🧪 **Discord Bot Test**\n\nThis is a test message to verify the bot can send DMs.\n\nTime: ${new Date().toLocaleString()}`;
    
    const message = await discordService.sendDirectMessage(userId, testMessage);
    
    return res.json({
      success: true,
      message: 'Test message sent to your Discord DMs',
      messageId: message?.id || 'unknown'
    });

  } catch (error: any) {
    logger.error('Discord bot test error', {
      action: 'discord_bot_test_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return res.status(500).json({
      error: 'Failed to send test message',
      details: error.message
    });
  }
});

// Test Telegram bot functionality (development only)
router.post('/vps/test-telegram', async (req, res) => {
  try {
    const user = req.user as any;
    const userId = user.id;

    if (!isAllowedForVPS(userId)) {
      return res.status(403).json({
        error: 'Access denied. You are not authorised to access VPS Monitor.'
      });
    }

    // Test Telegram DM
    const telegramService = new TelegramNotificationService();
    const testMessage = `🧪 *Telegram Bot Test*\n\nThis is a test message to verify the bot can send DMs.\n\nTime: ${new Date().toLocaleString()}`;
    
    const message = await telegramService.sendDirectMessage(userId, testMessage);
    
    return res.json({
      success: true,
      message: 'Test message sent to your Telegram DMs',
      messageId: message?.id || 'unknown'
    });

  } catch (error: any) {
    logger.error('Telegram bot test error', {
      action: 'telegram_bot_test_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return res.status(500).json({
      error: 'Failed to send test message',
      details: error.message
    });
  }
});

// Test email service functionality (development only)
router.post('/vps/test-email', async (req, res) => {
  try {
    const user = req.user as any;
    const userId = user.id;

    if (!isAllowedForVPS(userId)) {
      return res.status(403).json({
        error: 'Access denied. You are not authorised to access VPS Monitor.'
      });
    }

    // Test email service
    const emailService = new EmailNotificationService();
    
    return res.json({
      success: true,
      configured: emailService.isConfigured(),
      smtpHost: process.env.SMTP_HOST,
      smtpPort: process.env.SMTP_PORT,
      smtpUser: process.env.SMTP_USER,
      mailFrom: process.env.MAIL_FROM,
      hasPassword: !!process.env.SMTP_PASS
    });
    
  } catch (error: any) {
    logger.error('Email test error:', error);
    return res.status(500).json({
      error: 'Failed to test email service',
      details: error.message
    });
  }
});

// Debug environment variables (development only)
router.get('/debug/env', async (req, res) => {
  try {
    return res.json({
      success: true,
      smtpHost: process.env.SMTP_HOST,
      smtpPort: process.env.SMTP_PORT,
      smtpUser: process.env.SMTP_USER,
      mailFrom: process.env.MAIL_FROM,
      hasPassword: !!process.env.SMTP_PASS,
      nodeEnv: process.env.NODE_ENV,
      allEnvKeys: Object.keys(process.env).filter(key => key.includes('SMTP') || key.includes('MAIL'))
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Failed to get environment variables',
      details: error.message
    });
  }
});

// Request access to reset leaderboard (Discord or Telegram)
router.post('/reset-leaderboard/request-access', async (req, res) => {
  try {
    const user = req.user as any;
    const userId = user.id;
    const username = user.username;
    const { channel } = req.body; // 'discord', 'telegram', or undefined for both

    // Check if user is allowed VPS access
    if (!isAllowedForVPS(userId)) {
      return res.status(403).json({
        error: 'Access denied. You are not authorized to reset the leaderboard.'
      });
    }

    // Get or create codes for this user from database
    let resetCodeData = await dbService.getResetLeaderboardCode(userId);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    let discordCode: string;
    let telegramCode: string;
    let emailCode: string;
    let discordMessageId: string | undefined;
    let telegramMessageId: string | undefined;

    if (!resetCodeData || resetCodeData.isUsed) {
      // Generate new codes
      discordCode = generateVPSCode();
      telegramCode = generateVPSCode();
      emailCode = generate6DigitPin();
    } else {
      // Reuse existing codes
      discordCode = resetCodeData.discordCode;
      telegramCode = resetCodeData.telegramCode;
      emailCode = resetCodeData.emailCode || generate6DigitPin();
      discordMessageId = resetCodeData.discordMessageId;
      telegramMessageId = resetCodeData.telegramMessageId;
    }
    
    // Store codes in database
    await dbService.storeResetLeaderboardCode({
      userId,
      discordCode,
      telegramCode,
      emailCode,
      userEmail: user.email || '',
      username,
      expiresAt,
      discordMessageId,
      telegramMessageId
    });

    let discordSent = false;
    let telegramSent = false;
    let emailSent = false;

    // Send Discord code if requested
    if (!channel || channel === 'discord') {
      try {
        const discordService = new DiscordNotificationService();
        const discordMessage = await discordService.sendDirectMessage(
          userId,
          `🔐 **Reset Leaderboard Access Code (Discord)**\n\n` +
          `Your Discord access code is: **${discordCode}**\n` +
          `This code expires in 5 minutes.\n\n` +
          `⚠️ **Security Notice**: This code is required for leaderboard reset access.`
        );

        discordSent = discordMessage !== null;
        
        // Store Discord message ID for cleanup
        if (discordMessage && discordMessage.id) {
          discordMessageId = discordMessage.id;
          // Update in database
          await dbService.storeResetLeaderboardCode({
            userId,
            discordCode,
            telegramCode,
            emailCode,
            userEmail: user.email || '',
            username,
            expiresAt,
            discordMessageId: discordMessage.id,
            telegramMessageId
          });
        }

      } catch (discordError) {
        logger.error('Failed to send Discord DM', {
          action: 'discord_dm_error',
          userId,
          username,
          error: discordError instanceof Error ? discordError.message : 'Unknown error'
        });
      }
    }

    // Send Telegram code if requested and allowed
    if ((!channel || channel === 'telegram') && isAllowedForTelegram(userId) && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN !== 'your_telegram_bot_token_here') {
      try {
        const telegramService = new TelegramNotificationService();
        // Use the Telegram user ID (7631397609) for sending messages
        const telegramUserId = '7631397609';
        
        const telegramMessage = await telegramService.sendDirectMessage(
          telegramUserId,
          `🔐 *Reset Leaderboard Access Code (Telegram)*\n\n` +
          `Your Telegram access code is: *${telegramCode}*\n` +
          `This code expires in 5 minutes.\n\n` +
          `⚠️ *Security Notice*: This code is required for leaderboard reset access.`
        );

        telegramSent = telegramMessage !== null;
        
        // Store Telegram message ID for cleanup
        if (telegramMessage && telegramMessage.id) {
          telegramMessageId = telegramMessage.id;
          // Update in database
          await dbService.storeResetLeaderboardCode({
            userId,
            discordCode,
            telegramCode,
            emailCode,
            userEmail: user.email || '',
            username,
            expiresAt,
            discordMessageId,
            telegramMessageId: telegramMessage.id
          });
        }

      } catch (telegramError) {
        logger.error('Failed to send Telegram DM', {
          action: 'telegram_dm_error',
          userId,
          username,
          error: telegramError instanceof Error ? telegramError.message : 'Unknown error'
        });
        logger.warn('Telegram bot not working', {
          action: 'telegram_error',
          userId,
          username,
          error: telegramError instanceof Error ? telegramError.message : 'Unknown error'
        });
      }
    } else if (!channel || channel === 'telegram') {
      logger.warn('User not allowed for Telegram access or bot not configured', {
        action: 'telegram_access_denied',
        userId,
        username,
        reason: !isAllowedForTelegram(userId) ? 'user_not_allowed' : 'bot_not_configured'
      });
    }

    // Send Email code if requested
    const resetUserEmail = user.email || '';
    if ((!channel || channel === 'email') && resetUserEmail) {
      // Check if user's email is in the allowed list
      if (!isAllowedForEmail(resetUserEmail)) {
        logger.warn('Email not in ADMIN_EMAILS whitelist for leaderboard reset', {
          action: 'email_not_whitelisted',
          userId,
          username,
          email: resetUserEmail
        });
        
        if (channel === 'email') {
          return res.status(403).json({
            error: 'Your email is not authorised for email authentication. Please contact an administrator or use Discord/Telegram authentication.'
          });
        }
      } else {
        try {
          const emailService = new EmailNotificationService();
          
          if (emailService.isConfigured()) {
            emailSent = await emailService.sendPinCode(
              resetUserEmail,
              emailCode,
              'Leaderboard Reset Access'
            );
            
            if (emailSent) {
              logger.info('Leaderboard reset email code sent', {
                action: 'reset_leaderboard_email_sent',
                userId,
                username,
                email: resetUserEmail
              });
            }
          } else {
            logger.warn('Email service not configured', {
              action: 'email_not_configured',
              userId,
              username
            });
          }
        } catch (emailError) {
          logger.error('Failed to send email', {
            action: 'email_send_error',
            userId,
            username,
            error: emailError instanceof Error ? emailError.message : 'Unknown error'
          });
          logger.warn('Email sending failed', {
            action: 'email_error',
            userId,
            username,
            error: emailError instanceof Error ? emailError.message : 'Unknown error'
          });
        }
      }
    }

    // Check if the requested channel succeeded
    if (channel === 'discord' && !discordSent) {
      return res.status(500).json({
        error: 'Failed to send Discord access code. Please try again.'
      });
    }
    
    if (channel === 'telegram' && !telegramSent) {
      return res.status(500).json({
        error: 'Failed to send Telegram access code. Please try again.'
      });
    }
    
    if (channel === 'email' && !emailSent) {
      return res.status(500).json({
        error: 'Failed to send email access code. Please check your email configuration.'
      });
    }

    logger.logAdminAction(userId, 'reset_leaderboard_access_requested', {
      username,
      channel: channel || 'all',
      discordCodeGenerated: discordSent,
      telegramCodeGenerated: telegramSent,
      emailCodeGenerated: emailSent
    });

    return res.json({
      message: channel === 'discord' ? 'Discord access code sent!' : 
               channel === 'telegram' ? 'Telegram access code sent!' : 
               channel === 'email' ? 'Email access code sent!' :
               `Access codes sent to: ${[discordSent && 'Discord', telegramSent && 'Telegram', emailSent && 'Email'].filter(Boolean).join(', ')}`,
      discordSent,
      telegramSent,
      emailSent,
      userEmail: user.email || null,
      expiresIn: 5 * 60 * 1000 // 5 minutes in milliseconds
    });

  } catch (error) {
    logger.error('Reset leaderboard access request error', {
      action: 'reset_leaderboard_request_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return res.status(500).json({
      error: 'Failed to process access request'
    });
  }
});

// Verify access codes for reset leaderboard
router.post('/reset-leaderboard/verify-access', async (req, res) => {
  try {
    const user = req.user as any;
    const userId = user.id;
    const username = user.username;
    const { discordCode, telegramCode } = req.body;

    if (!discordCode || typeof discordCode !== 'string') {
      return res.status(400).json({
        error: 'Discord verification code is required'
      });
    }

    // Check if user has a pending verification code from database
    const verificationData = await dbService.getResetLeaderboardCode(userId);
    
    if (!verificationData) {
      return res.status(400).json({
        error: 'No verification codes found. Please request access first.'
      });
    }
    
    // Check if codes have expired
    if (new Date() > verificationData.expiresAt) {
      await dbService.deleteResetLeaderboardCode(userId);
      return res.status(400).json({
        error: 'Verification codes have expired. Please request new ones.'
      });
    }

    // Check attempt limit (max 3 attempts)
    if (verificationData.attempts >= 3) {
      await dbService.deleteResetLeaderboardCode(userId);
      return res.status(400).json({
        error: 'Too many failed attempts. Please request new verification codes.'
      });
    }

    // Verify Discord code
    if (discordCode !== verificationData.discordCode) {
      await dbService.incrementResetLeaderboardCodeAttempts(userId);
      const updatedData = await dbService.getResetLeaderboardCode(userId);
      
      return res.status(400).json({
        error: 'Invalid Discord verification code',
        attemptsRemaining: updatedData ? 3 - updatedData.attempts : 0
      });
    }

    // Check if Telegram verification is needed
    const needsTelegramCode = isAllowedForTelegram(userId) && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN !== 'your_telegram_bot_token_here';
    
    if (needsTelegramCode) {
      if (!telegramCode || typeof telegramCode !== 'string') {
        return res.status(400).json({
          error: 'Telegram verification code is required'
        });
      }

      if (telegramCode !== verificationData.telegramCode) {
        await dbService.incrementResetLeaderboardCodeAttempts(userId);
        const updatedData = await dbService.getResetLeaderboardCode(userId);
        
        return res.status(400).json({
          error: 'Invalid Telegram verification code',
          attemptsRemaining: updatedData ? 3 - updatedData.attempts : 0
        });
      }
    }

    // All codes are valid - mark as used and grant access
    await dbService.markResetLeaderboardCodeAsUsed(userId);
    
    // Delete the original verification messages
    try {
      if (verificationData.discordMessageId) {
        const discordService = new DiscordNotificationService();
        await discordService.deleteMessage(userId, verificationData.discordMessageId);
      }
      
      if (verificationData.telegramMessageId) {
        const telegramService = new TelegramNotificationService();
        const telegramUserId = '7631397609'; // Use the Telegram user ID
        await telegramService.deleteMessage(telegramUserId, verificationData.telegramMessageId);
      }
    } catch (deleteError) {
      logger.warn('Failed to delete verification messages', {
        action: 'verification_message_delete_error',
        error: deleteError instanceof Error ? deleteError.message : 'Unknown error'
      });
    }
    
    // Send confirmation messages
    try {
      const discordService = new DiscordNotificationService();
      const confirmMessage = `✅ **Reset Leaderboard Access Granted**\n\n**Admin:** ${username}\n**Verified:** Discord${needsTelegramCode ? ' + Telegram' : ''}\n**Time:** ${new Date().toLocaleString()}\n\n🎉 You now have access to reset the leaderboard. This message will auto-delete in 24 hours.`;
      
      const confirmSentMessage = await discordService.sendDirectMessage(userId, confirmMessage);
      
      // Schedule auto-deletion of confirmation message after 24 hours
      if (confirmSentMessage?.id) {
        setTimeout(async () => {
          try {
            const discordService = new DiscordNotificationService();
            await discordService.deleteMessage(userId, confirmSentMessage.id);
          } catch (deleteError) {
            logger.warn('Failed to auto-delete confirmation message', {
              action: 'discord_auto_delete_error',
              error: deleteError instanceof Error ? deleteError.message : 'Unknown error'
            });
          }
        }, 24 * 60 * 60 * 1000); // 24 hours
      }
      
      if (needsTelegramCode) {
        const telegramService = new TelegramNotificationService();
        const telegramUserId = '7631397609';
        const telegramConfirmMessage = `✅ *Reset Leaderboard Access Granted*\n\n*Admin:* ${username}\n*Verified:* Discord + Telegram\n*Time:* ${new Date().toLocaleString()}\n\n🎉 You now have access to reset the leaderboard.`;
        await telegramService.sendDirectMessage(telegramUserId, telegramConfirmMessage);
      }
    } catch (confirmError) {
      logger.warn('Failed to send confirmation messages', {
        action: 'confirmation_message_error',
        error: confirmError instanceof Error ? confirmError.message : 'Unknown error'
      });
    }
    
    // Grant access for 10 minutes
    const accessExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await dbService.storeResetLeaderboardAccess({
      userId,
      expiresAt: accessExpiresAt
    });

    logger.info(`Reset leaderboard access granted to admin ${user.username} (${userId})`);
    
    return res.json({
      success: true,
      message: 'Access granted successfully',
      expiresAt: accessExpiresAt.toISOString()
    });
    
  } catch (error: any) {
    logger.error('Reset leaderboard verification error:', error);
    return res.status(500).json({
      error: 'Failed to verify access code',
      details: error.message
    });
  }
});

// Check reset leaderboard access status
router.get('/reset-leaderboard/access-status', async (req, res) => {
  try {
    const user = req.user as any;
    const userId = user.id;

    // Check if user is allowed VPS access
    const isAllowed = isAllowedForVPS(userId);
    const resetCodeData = await dbService.getResetLeaderboardCode(userId);
    const hasActiveCode = resetCodeData !== null && !resetCodeData.isUsed && resetCodeData.expiresAt > new Date();
    const dualChannelAuth = isAllowedForTelegram(userId) && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_TOKEN !== 'your_telegram_bot_token_here';

    if (!isAllowed) {
      return res.status(403).json({
        error: 'Access denied. You are not authorized to reset the leaderboard.'
      });
    }

    const accessData = await dbService.getResetLeaderboardAccess(userId);
    
    if (!accessData) {
      return res.json({
        isAllowed: true,
        hasActiveCode,
        dualChannelAuth,
        hasAccess: false,
        message: 'No access granted'
      });
    }
    
    // Check if access has expired
    if (new Date() > accessData.expiresAt) {
      await dbService.deleteResetLeaderboardAccess(userId);
      return res.json({
        isAllowed: true,
        hasActiveCode,
        dualChannelAuth,
        hasAccess: false,
        message: 'Access has expired'
      });
    }

    return res.json({
      isAllowed: true,
      hasActiveCode,
      dualChannelAuth,
      hasAccess: true,
      grantedAt: accessData.grantedAt.toISOString(),
      expiresAt: accessData.expiresAt.toISOString()
    });
    
  } catch (error: any) {
    logger.error('Reset leaderboard access status error:', error);
    return res.status(500).json({
      error: 'Failed to check access status'
    });
  }
});

// Reset leaderboard (clears all claim records while preserving registrations)
router.post('/reset-leaderboard', async (req, res) => {
  try {
    const user = req.user as any;
    const userId = user.id;

    // Check if user has valid access from database
    const accessData = await dbService.getResetLeaderboardAccess(userId);
    
    if (!accessData) {
      return res.status(403).json({
        error: 'Access denied. Please request access first.'
      });
    }
    
    // Check if access has expired
    if (new Date() > accessData.expiresAt) {
      await dbService.deleteResetLeaderboardAccess(userId);
      return res.status(403).json({
        error: 'Access has expired. Please request access again.'
      });
    }

    // Remove access after use
    await dbService.deleteResetLeaderboardAccess(userId);
    
    logger.info(`Admin ${user.username} (${user.id}) initiated leaderboard reset`);
    
    // Get current statistics before reset
    const totalClaimRecords = await dbService.findClaimRecords();
    const totalUsers = await dbService.findRegistrations();
    
    // Create backup directory if it doesn't exist
    const backupDir = path.join(process.cwd(), 'database-backups');
    const fs = require('fs');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Create timestamp for backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Backup claim records before deletion
    const claimRecords = await dbService.findClaimRecords();
    const backupFile = path.join(backupDir, `claim-records-backup-${timestamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      totalRecords: claimRecords.length,
      totalUsers: totalUsers,
      records: claimRecords
    }, null, 2));
    
    // Delete all claim records
    const deleteResult = await dbService.deleteAllClaimRecords();
    
    // Create reset report
    const resetReport = {
      timestamp: new Date().toISOString(),
      adminUser: {
        username: user.username,
        id: user.id
      },
      resetStats: {
        claimRecordsDeleted: deleteResult,
        usersPreserved: totalUsers.length,
        backupFile: backupFile
      }
    };
    
    const reportFile = path.join(process.cwd(), 'leaderboard-reset-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(resetReport, null, 2));
    
    logger.info(`Leaderboard reset completed: ${deleteResult} claim records deleted, ${totalUsers.length} users preserved`);
    
    // Send Discord notification
    const discordService = new DiscordNotificationService();
    const resetMessage = `🔄 **Leaderboard Reset**\n\n**Admin:** ${user.username}\n**Records Deleted:** ${deleteResult}\n**Users Preserved:** ${totalUsers.length}\n**Backup Created:** ${backupFile}\n\nTime: ${new Date().toLocaleString()}`;
    
    try {
      await discordService.sendToChannel(process.env.SCHEDULER_CHANNEL_ID!, resetMessage);
    } catch (discordError) {
      logger.warn('Failed to send Discord notification for leaderboard reset', {
        action: 'discord_reset_notification_error',
        error: discordError instanceof Error ? discordError.message : 'Unknown error'
      });
    }
    
    return res.json({
      success: true,
      message: 'Leaderboard reset successfully',
      stats: {
        claimRecordsDeleted: deleteResult,
        usersPreserved: totalUsers.length,
        backupFile: backupFile,
        reportFile: reportFile
      }
    });
    
  } catch (error: any) {
    logger.error('Leaderboard reset error:', error);
    return res.status(500).json({
      error: 'Failed to reset leaderboard',
      details: error.message
    });
  }
});

// Bot Status Management Endpoints

// Get current bot status (admin endpoint - requires auth)
router.get('/bot-status', async (req, res) => {
  try {
    // Make a request to the Discord bot service to get current status
    const discordPort = process.env.DISCORD_API_PORT || '2700';
    // In Docker, use service name; otherwise use localhost
    const botServiceUrl = process.env.DISCORD_BOT_SERVICE_URL || 
      (process.env.NODE_ENV === 'production' && process.env.POSTGRES_HOST === 'postgres' 
        ? `http://discord-api:${discordPort}` 
        : `http://localhost:${discordPort}`);
    
    try {
      const response = await axios.get(`${botServiceUrl}/api/bot-status`, {
        timeout: 5000
      });
      
      return res.json({
        success: true,
        data: response.data
      });
    } catch (botError) {
      // If bot service is not available, return basic info
      return res.json({
        success: true,
        data: {
          botReady: false,
          error: 'Discord bot service not available',
          currentStatus: 'unknown',
          environmentStatus: process.env.DISCORD_BOT_STATUS || 'dnd'
        }
      });
    }
    
  } catch (error: any) {
    logger.error('Error getting bot status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get bot status',
      details: error.message
    });
  }
});

// Change bot status
router.post('/bot-status', async (req, res) => {
  try {
    const { status } = req.body;
    const user = req.user as any;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }
    
    // Validate status
    const validStatuses = ['online', 'idle', 'dnd', 'invisible'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be: online, idle, dnd, or invisible'
      });
    }
    
    // Make a request to the Discord bot service to change status
    const discordPort = process.env.DISCORD_API_PORT || '2700';
    // In Docker, use service name; otherwise use localhost
    const botServiceUrl = process.env.DISCORD_BOT_SERVICE_URL || 
      (process.env.NODE_ENV === 'production' && process.env.POSTGRES_HOST === 'postgres' 
        ? `http://discord-api:${discordPort}` 
        : `http://localhost:${discordPort}`);
    
    try {
      const response = await axios.post(`${botServiceUrl}/api/bot-status`, {
        status: status
      }, {
        timeout: 10000
      });
      
      logger.info(`Bot status changed to ${status} by admin ${user.username}`, {
        action: 'bot_status_change',
        adminUser: user.username,
        newStatus: status,
        result: response.data
      });
      
      return res.json({
        success: true,
        message: `Bot status changed to ${status.toUpperCase()}`,
        data: response.data
      });
      
    } catch (botError: any) {
      logger.error('Error changing bot status:', botError);
      return res.status(500).json({
        success: false,
        error: 'Failed to change bot status',
        details: botError.response?.data?.error || botError.message
      });
    }
    
  } catch (error: any) {
    logger.error('Error in bot status change endpoint:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to change bot status',
      details: error.message
    });
  }
});

// Bot toggle endpoint (enable/disable bot)
router.post('/bot-toggle', async (req, res) => {
  try {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'enabled field must be a boolean'
      });
    }

    // Make a request to the Discord bot service to toggle bot
    const discordPort = process.env.DISCORD_API_PORT || '2700';
    // In Docker, use service name; otherwise use localhost
    const botServiceUrl = process.env.DISCORD_BOT_SERVICE_URL || 
      (process.env.NODE_ENV === 'production' && process.env.POSTGRES_HOST === 'postgres' 
        ? `http://discord-api:${discordPort}` 
        : `http://localhost:${discordPort}`);
    
    try {
      const response = await axios.post(`${botServiceUrl}/api/bot-toggle`, {
        enabled: enabled
      }, {
        timeout: 5000
      });
      
      return res.json({
        success: true,
        data: response.data,
        message: `Bot ${enabled ? 'enabled' : 'disabled'} successfully`
      });
      
    } catch (botError: any) {
      logger.error('Error toggling bot:', {
        message: botError.message,
        status: botError.response?.status,
        statusText: botError.response?.statusText,
        data: botError.response?.data
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to toggle bot',
        details: botError.response?.data?.error || botError.message
      });
    }
    
  } catch (error: any) {
    logger.error('Error in bot toggle endpoint:', {
      message: error.message,
      stack: error.stack
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to toggle bot',
      details: error.message
    });
  }
});


import activeServicesRouter from './admin-active-services';

// Use the active services router
router.use('/', activeServicesRouter);

// Deregistration Request Management Routes

// Get all pending deregistration requests
router.get('/deregistration-requests', async (req, res) => {
  try {
    const result = await dbService.executeQuery(
      `SELECT dr.*, r.username, r.created_at as account_created_at
       FROM deregistration_requests dr
       LEFT JOIN registrations r ON dr.eight_ball_pool_id = r.eight_ball_pool_id
       WHERE dr.status = 'pending'
       ORDER BY dr.requested_at DESC`
    );

    if (!result || !result.rows) {
      logger.warn('No result rows returned from deregistration requests query');
      return res.json({
        success: true,
        requests: []
      });
    }

    // Get claim stats and screenshots for each request
    const requestsWithDetails = await Promise.all(
      result.rows.map(async (req: any) => {
        try {
          // Get claim stats
          const successResult = await dbService.executeQuery(
            `SELECT COUNT(*) as count FROM claim_records 
             WHERE eight_ball_pool_id = $1 AND status = 'success'`,
            [req.eight_ball_pool_id]
          );
          const failedResult = await dbService.executeQuery(
            `SELECT COUNT(*) as count FROM claim_records 
             WHERE eight_ball_pool_id = $1 AND status = 'failed'`,
            [req.eight_ball_pool_id]
          );

          // Find confirmation screenshot
          // Use absolute path - screenshots are in /app/screenshots/confirmation in container
          const screenshotsDir = process.env.SCREENSHOTS_DIR || 
            (process.env.NODE_ENV === 'production' 
              ? '/app/screenshots/confirmation'
              : path.join(__dirname, '../../../../screenshots/confirmation'));
          let screenshotUrl: string | null = null;
          if (fs.existsSync(screenshotsDir)) {
            const files = fs.readdirSync(screenshotsDir);
            const screenshot = files.find(file => 
              file.includes(req.eight_ball_pool_id) && 
              (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'))
            );
            if (screenshot) {
              screenshotUrl = `/8bp-rewards/api/admin/screenshots/view/confirmation/${screenshot}`;
            }
          }

          return {
            ...req,
            successfulClaims: parseInt(successResult.rows[0]?.count || '0'),
            failedClaims: parseInt(failedResult.rows[0]?.count || '0'),
            screenshotUrl
          };
        } catch (itemError) {
          logger.error('Error processing deregistration request item', {
            action: 'process_deregistration_request_item_error',
            error: itemError instanceof Error ? itemError.message : 'Unknown error',
            requestId: req.id,
            eightBallPoolId: req.eight_ball_pool_id
          });
          // Return basic info even if stats fail
          return {
            ...req,
            successfulClaims: 0,
            failedClaims: 0,
            screenshotUrl: null
          };
        }
      })
    );

    return res.json({
      success: true,
      requests: requestsWithDetails
    });
  } catch (error) {
    logger.error('Error fetching deregistration requests', {
      action: 'get_deregistration_requests_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch deregistration requests',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Approve a deregistration request
router.post('/deregistration-requests/:id/approve', async (req, res) => {
  try {
    const user = req.user as any;
    const requestId = req.params.id;
    const { reviewNotes } = req.body;

    // Get the request
    const requestResult = await dbService.executeQuery(
      `SELECT * FROM deregistration_requests WHERE id = $1 AND status = 'pending'`,
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Request not found or already processed'
      });
    }

    const request = requestResult.rows[0];

    // Delete the registration
    await dbService.executeQuery(
      `DELETE FROM registrations WHERE eight_ball_pool_id = $1`,
      [request.eight_ball_pool_id]
    );

    // Update request status
    await dbService.executeQuery(
      `UPDATE deregistration_requests 
       SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP, 
           reviewed_by = $1, review_notes = $2
       WHERE id = $3`,
      [user.id, reviewNotes || null, requestId]
    );

    logger.info('Deregistration request approved', {
      action: 'deregistration_approved',
      requestId,
      eightBallPoolId: request.eight_ball_pool_id,
      discordId: request.discord_id,
      reviewedBy: user.id
    });

    // Send Discord embed notification
    try {
      const discordService = new DiscordNotificationService();
      const discordTag = `${user.username}#${user.discriminator || '0000'}`;
      await discordService.sendDeregistrationReviewEmbed(
        'approved',
        request.discord_id,
        discordTag,
        request.eight_ball_pool_id,
        user.username,
        reviewNotes || undefined
      );
    } catch (discordError) {
      logger.warn('Failed to send Discord notification for deregistration approval', {
        action: 'discord_notification_failed',
        error: discordError instanceof Error ? discordError.message : 'Unknown error'
      });
    }

    return res.json({
      success: true,
      message: 'Deregistration request approved and account removed'
    });
  } catch (error) {
    logger.error('Error approving deregistration request', {
      action: 'approve_deregistration_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.params.id
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to approve deregistration request'
    });
  }
});

// Deny a deregistration request
router.post('/deregistration-requests/:id/deny', async (req, res) => {
  try {
    const user = req.user as any;
    const requestId = req.params.id;
    const { reviewNotes } = req.body;

    // Update request status
    await dbService.executeQuery(
      `UPDATE deregistration_requests 
       SET status = 'denied', reviewed_at = CURRENT_TIMESTAMP, 
           reviewed_by = $1, review_notes = $2
       WHERE id = $3`,
      [user.id, reviewNotes || null, requestId]
    );

    logger.info('Deregistration request denied', {
      action: 'deregistration_denied',
      requestId,
      reviewedBy: user.id
    });

    // Send Discord embed notification
    try {
      const requestResult = await dbService.executeQuery(
        `SELECT * FROM deregistration_requests WHERE id = $1`,
        [requestId]
      );
      const request = requestResult.rows[0];
      
      const discordService = new DiscordNotificationService();
      const discordTag = `${user.username}#${user.discriminator || '0000'}`;
      await discordService.sendDeregistrationReviewEmbed(
        'denied',
        request.discord_id,
        discordTag,
        request.eight_ball_pool_id,
        user.username,
        reviewNotes || undefined
      );
    } catch (discordError) {
      logger.warn('Failed to send Discord notification for deregistration denial', {
        action: 'discord_notification_failed',
        error: discordError instanceof Error ? discordError.message : 'Unknown error'
      });
    }

    return res.json({
      success: true,
      message: 'Deregistration request denied'
    });
  } catch (error) {
    logger.error('Error denying deregistration request', {
      action: 'deny_deregistration_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.params.id
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to deny deregistration request'
    });
  }
});

// Get all verification images (admin only)
router.get('/verification-images', async (req, res): Promise<void> => {
  try {
    const verificationsDir = process.env.VERIFICATIONS_DIR || 
      (process.env.NODE_ENV === 'production' 
        ? '/app/services/verification-bot/verifications'
        : path.join(__dirname, '../../../../services/verification-bot/verifications'));

    if (!fs.existsSync(verificationsDir)) {
      logger.info('Verifications directory does not exist', {
        action: 'verifications_dir_missing',
        path: verificationsDir
      });
      res.json({
        success: true,
        verificationImages: []
      });
      return;
    }

    const files = fs.readdirSync(verificationsDir);
    const verificationImages: Array<{
      filename: string;
      imageUrl: string;
      discordId: string | null;
      uniqueId: string | null;
      level: number | null;
      rankName: string | null;
      timestamp: string | null;
      capturedAt: string | null;
    }> = [];

    // Parse verification image filenames: verification-{discordId}-{uniqueId}-{level}-{rankName}-{timestamp}.{ext}
    for (const filename of files) {
      if (!filename.startsWith('verification-')) {
        continue;
      }

      // Parse filename to extract metadata
      // Format: verification-{discordId}-{uniqueId}-{level}-{rankName}-{timestamp}.{ext}
      // Rank name may contain underscores, so we need to match everything between level and timestamp
      const match = filename.match(/^verification-(\d+)-([^-]+)-(\d+)-(.+)-(.+)\.(jpg|jpeg|png)$/i);
      if (match) {
        const [, discordId, uniqueId, level, rankNameWithUnderscores, timestamp] = match;
        const rankName = rankNameWithUnderscores.replace(/_/g, ' '); // Convert underscores back to spaces
        
        // Parse timestamp from filename
        let capturedAt: string | null = null;
        try {
          const timestampParts = timestamp.split('-');
          if (timestampParts.length >= 6) {
            const dateStr = `${timestampParts[0]}-${timestampParts[1]}-${timestampParts[2]}T${timestampParts[3]}:${timestampParts[4]}:${timestampParts[5]}.${timestampParts[6] || '000'}Z`;
            capturedAt = new Date(dateStr).toISOString();
          }
        } catch (e) {
          // If timestamp parsing fails, use file stats
          const filePath = path.join(verificationsDir, filename);
          try {
            const stats = fs.statSync(filePath);
            capturedAt = stats.birthtime.toISOString();
          } catch (statError) {
            logger.warn('Failed to get file stats', { filename, error: statError });
          }
        }

        verificationImages.push({
          filename,
          imageUrl: `/8bp-rewards/api/admin/verification-images/view/${filename}`,
          discordId,
          uniqueId: uniqueId !== 'unknown' ? uniqueId : null,
          level: parseInt(level, 10) || null,
          rankName: rankName.replace(/_/g, ' ') || null,
          timestamp,
          capturedAt
        });
      } else {
        // Fallback: if filename doesn't match pattern, still include it
        const filePath = path.join(verificationsDir, filename);
        try {
          const stats = fs.statSync(filePath);
          // Try to extract Discord ID from filename
          const discordIdMatch = filename.match(/^verification-(\d+)-/);
          verificationImages.push({
            filename,
            imageUrl: `/8bp-rewards/api/admin/verification-images/view/${filename}`,
            discordId: discordIdMatch ? discordIdMatch[1] : null,
            uniqueId: null,
            level: null,
            rankName: null,
            timestamp: null,
            capturedAt: stats.birthtime.toISOString()
          });
        } catch (statError) {
          logger.warn('Failed to process verification image', { filename, error: statError });
        }
      }
    }

    // Sort by capturedAt descending (newest first)
    verificationImages.sort((a, b) => {
      const timeA = a.capturedAt ? new Date(a.capturedAt).getTime() : 0;
      const timeB = b.capturedAt ? new Date(b.capturedAt).getTime() : 0;
      return timeB - timeA;
    });

    logger.info('Fetched all verification images', {
      action: 'get_all_verification_images',
      count: verificationImages.length
    });

    res.json({
      success: true,
      verificationImages
    });
    return;
  } catch (error) {
    logger.error('Error fetching verification images', {
      action: 'get_all_verification_images_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch verification images'
    });
  }
});

// Assign avatars to users
router.post('/assign-avatars', authenticateAdmin, async (req, res): Promise<void> => {
  try {
    const { userIds, avatarType } = req.body;
    const adminId = (req as AdminRequest).user?.id;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'userIds array is required and must not be empty'
      });
      return;
    }

    if (!avatarType) {
      res.status(400).json({
        success: false,
        error: 'avatarType is required (either "random" or a specific avatar filename)'
      });
      return;
    }

    logger.info('Admin avatar assignment request', {
      action: 'admin_assign_avatars',
      adminId,
      userIdCount: userIds.length,
      avatarType
    });

    const avatarsDir = path.join(process.cwd(), 'frontend', '8 Ball Pool Avatars');
    let selectedAvatarFilename: string | null = null;

    // Determine which avatar to assign
    if (avatarType === 'random') {
      selectedAvatarFilename = getRandom8BPAvatar();
      if (!selectedAvatarFilename) {
        res.status(500).json({
          success: false,
          error: 'Failed to get random avatar'
        });
        return;
      }
    } else {
      // Validate that the specific avatar exists
      const avatarPath = path.join(avatarsDir, avatarType);
      if (!fs.existsSync(avatarPath)) {
        res.status(400).json({
          success: false,
          error: `Avatar file not found: ${avatarType}`
        });
        return;
      }
      selectedAvatarFilename = avatarType;
    }

    const results: Array<{ userId: string; success: boolean; error?: string }> = [];
    let assigned = 0;
    let failed = 0;

    // Process each user
    for (const userId of userIds) {
      try {
        // Find registration by eightBallPoolId
        const registration = await dbService.findRegistration({ eightBallPoolId: userId });
        
        if (!registration) {
          results.push({
            userId,
            success: false,
            error: 'User not found'
          });
          failed++;
          continue;
        }

        // Update registration with avatar
        await dbService.updateRegistration(userId, {
          eight_ball_pool_avatar_filename: selectedAvatarFilename
        });

        // Emit WebSocket event for avatar update
        if (registration.discordId) {
          // Compute active avatar URL
          let activeAvatarUrl: string | null = null;
          if (registration.leaderboard_image_url) {
            activeAvatarUrl = registration.leaderboard_image_url;
          } else if (selectedAvatarFilename) {
            activeAvatarUrl = `/8bp-rewards/avatars/${selectedAvatarFilename}`;
          } else if (registration.use_discord_avatar && registration.discordId && registration.discord_avatar_hash) {
            activeAvatarUrl = `https://cdn.discordapp.com/avatars/${registration.discordId}/${registration.discord_avatar_hash}.png`;
          } else if (registration.profile_image_url) {
            activeAvatarUrl = registration.profile_image_url;
          }

          WebSocketService.emitAvatarUpdate(registration.discordId, {
            eightBallPoolId: userId,
            activeAvatarUrl,
            activeUsername: registration.username,
            profile_image_url: registration.profile_image_url || null,
            leaderboard_image_url: registration.leaderboard_image_url || null,
            eight_ball_pool_avatar_filename: selectedAvatarFilename,
            use_discord_avatar: registration.use_discord_avatar ?? (registration.discordId ? true : false),
            use_discord_username: registration.use_discord_username ?? false,
            discord_avatar_hash: registration.discord_avatar_hash || null
          });
          WebSocketService.emitAvatarsRefresh(registration.discordId);
        }

        results.push({
          userId,
          success: true
        });
        assigned++;

        logger.info('Avatar assigned to user', {
          action: 'avatar_assigned',
          adminId,
          userId,
          avatarFilename: selectedAvatarFilename
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          userId,
          success: false,
          error: errorMessage
        });
        failed++;

        logger.error('Failed to assign avatar to user', {
          action: 'avatar_assignment_failed',
          adminId,
          userId,
          error: errorMessage
        });
      }
    }

    logger.info('Avatar assignment completed', {
      action: 'admin_assign_avatars_complete',
      adminId,
      total: userIds.length,
      assigned,
      failed,
      avatarFilename: selectedAvatarFilename
    });

    res.json({
      success: true,
      assigned,
      failed,
      results,
      avatarFilename: selectedAvatarFilename
    });
  } catch (error) {
    logger.error('Error assigning avatars', {
      action: 'admin_assign_avatars_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as AdminRequest).user?.id
    });
    res.status(500).json({
      success: false,
      error: 'Failed to assign avatars'
    });
  }
});

// Serve verification image (admin only)
router.get('/verification-images/view/:filename', async (req, res): Promise<void> => {
  try {
    const { filename } = req.params;

    // Validate filename to prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      res.status(400).json({
        success: false,
        message: 'Invalid filename'
      });
      return;
    }

    const verificationsDir = process.env.VERIFICATIONS_DIR || path.join(process.cwd(), 'services', 'verification-bot', 'verifications');
    const imagePath = path.join(verificationsDir, filename);

    if (!fs.existsSync(imagePath)) {
      res.status(404).json({
        success: false,
        message: 'Verification image not found'
      });
      return;
    }

    // Determine content type from extension
    const ext = path.extname(filename).toLowerCase();
    const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';

    // Set appropriate headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Stream the image file
    const fileStream = fs.createReadStream(imagePath);
    fileStream.pipe(res);
  } catch (error) {
    logger.error('Error serving verification image', {
      action: 'serve_verification_image_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({
      success: false,
      message: 'Failed to serve verification image'
    });
  }
});

export default router;




