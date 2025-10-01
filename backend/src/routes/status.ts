import express from 'express';
import mongoose from 'mongoose';
import { logger } from '../services/LoggerService';
import { DatabaseService } from '../services/DatabaseService';

const router = express.Router();

// Get system status
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Database connectivity check
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    // Get database stats
    const dbStats = {
      connected: dbStatus === 'connected',
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name
    };

    // Get system uptime
    const uptime = process.uptime();
    const uptimeFormatted = {
      seconds: Math.floor(uptime),
      formatted: formatUptime(uptime)
    };

    // Get memory usage
    const memoryUsage = process.memoryUsage();
    const memoryFormatted = {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
    };

    // Get environment info
    const environment = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      env: process.env.NODE_ENV || 'development',
      pid: process.pid
    };

    const responseTime = Date.now() - startTime;

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: uptimeFormatted,
      database: dbStats,
      memory: memoryFormatted,
      environment,
      responseTime: `${responseTime}ms`
    });

  } catch (error) {
    logger.error('System status check failed', {
      action: 'system_status_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Failed to retrieve system status'
    });
  }
});

// Get scheduler status
router.get('/scheduler', async (req, res) => {
  try {
    // This would be implemented when we create the scheduler service
    // For now, return basic info
    res.json({
      status: 'active',
      lastRun: 'Not implemented yet',
      nextRun: 'Not implemented yet',
      schedule: '00:00, 06:00, 12:00, 18:00 UTC',
      timezone: 'UTC'
    });

  } catch (error) {
    logger.error('Scheduler status check failed', {
      action: 'scheduler_status_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      error: 'Failed to retrieve scheduler status'
    });
  }
});

// Get database status
router.get('/database', async (req, res) => {
  try {
    const dbService = new DatabaseService();
    const healthCheck = await dbService.healthCheck();

    res.json({
      ...healthCheck,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Database status check failed', {
      action: 'database_status_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      error: 'Failed to retrieve database status'
    });
  }
});

// Get application metrics
router.get('/metrics', async (req, res) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      environment: process.env.NODE_ENV || 'development'
    };

    res.json(metrics);

  } catch (error) {
    logger.error('Metrics retrieval failed', {
      action: 'metrics_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      error: 'Failed to retrieve metrics'
    });
  }
});

// Helper function to format uptime
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);

  return parts.join(' ') || '0s';
}

export default router;

