import winston from 'winston';
import { LogEntry } from '../models/LogEntry';
import mongoose from 'mongoose';

interface LogMeta {
  userId?: string;
  action?: string;
  ip?: string;
  userAgent?: string;
  [key: string]: any;
}

class LoggerService {
  private logger: winston.Logger;
  private isConnected: boolean = false;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: '8bp-rewards' },
      transports: [
        // Console transport
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        // File transport
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        })
      ]
    });

    // Add MongoDB transport if connected
    this.setupMongoTransport();
  }

  private async setupMongoTransport(): Promise<void> {
    try {
      if (mongoose.connection.readyState === 1) {
        this.addMongoTransport();
        this.isConnected = true;
      } else {
        // Wait for MongoDB connection
        mongoose.connection.once('open', () => {
          this.addMongoTransport();
          this.isConnected = true;
        });
      }
    } catch (error) {
      console.error('Failed to setup MongoDB transport:', error);
    }
  }

  private addMongoTransport(): void {
    // MongoDB transport is not available in current winston version
    // Using console transport instead for now
    console.log('MongoDB transport not available, using console logging');
  }

  private async logToMongo(level: string, message: string, meta: LogMeta = {}): Promise<void> {
    try {
      if (this.isConnected) {
        const logEntry = new LogEntry({
          level: level as 'error' | 'warn' | 'info' | 'debug',
          message,
          meta,
          timestamp: new Date(),
          service: '8bp-rewards',
          userId: meta.userId,
          action: meta.action,
          ip: meta.ip,
          userAgent: meta.userAgent
        });

        await logEntry.save();
      }
    } catch (error) {
      console.error('Failed to log to MongoDB:', error);
    }
  }

  public info(message: string, meta: LogMeta = {}): void {
    this.logger.info(message, meta);
    this.logToMongo('info', message, meta);
  }

  public warn(message: string, meta: LogMeta = {}): void {
    this.logger.warn(message, meta);
    this.logToMongo('warn', message, meta);
  }

  public error(message: string, meta: LogMeta = {}): void {
    this.logger.error(message, meta);
    this.logToMongo('error', message, meta);
  }

  public debug(message: string, meta: LogMeta = {}): void {
    this.logger.debug(message, meta);
    this.logToMongo('debug', message, meta);
  }

  // Specific logging methods for different actions
  public logRegistration(eightBallPoolId: string, username: string, ip?: string): void {
    this.info(`User registered: ${username} (${eightBallPoolId})`, {
      action: 'registration',
      userId: eightBallPoolId,
      ip
    });
  }

  public logClaimAttempt(eightBallPoolId: string, status: 'success' | 'failed', items?: string[], error?: string): void {
    const message = status === 'success' 
      ? `Claim successful for ${eightBallPoolId}: ${items?.join(', ') || 'No items'}`
      : `Claim failed for ${eightBallPoolId}: ${error}`;

    if (status === 'success') {
      this.info(message, {
        action: 'claim_success',
        userId: eightBallPoolId
      });
    } else {
      this.error(message, {
        action: 'claim_failed',
        userId: eightBallPoolId
      });
    }
  }

  public logSchedulerRun(totalAttempted: number, totalSucceeded: number, totalFailed: number): void {
    this.info(`Scheduler run completed: ${totalSucceeded}/${totalAttempted} successful`, {
      action: 'scheduler_run',
      totalAttempted,
      totalSucceeded,
      totalFailed
    });
  }

  public logAdminAction(adminId: string, action: string, details?: any): void {
    this.info(`Admin action: ${action}`, {
      action: 'admin_action',
      userId: adminId,
      ...details
    });
  }

  public logEmailSent(to: string, subject: string, success: boolean): void {
    const message = success 
      ? `Email sent successfully to ${to}: ${subject}`
      : `Failed to send email to ${to}: ${subject}`;

    if (success) {
      this.info(message, { action: 'email_sent' });
    } else {
      this.error(message, { action: 'email_failed' });
    }
  }

  public logDiscordNotification(channel: string, type: string, success: boolean): void {
    const message = success 
      ? `Discord notification sent to ${channel}: ${type}`
      : `Failed to send Discord notification to ${channel}: ${type}`;

    if (success) {
      this.info(message, { action: 'discord_notification' });
    } else {
      this.error(message, { action: 'discord_notification_failed' });
    }
  }

  // Method to get logs with pagination
  public async getLogs(page: number = 1, limit: number = 50, filters: any = {}): Promise<any[]> {
    try {
      const skip = (page - 1) * limit;
      return await LogEntry.find(filters)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
    } catch (error) {
      this.error('Failed to retrieve logs', { action: 'get_logs', error: error instanceof Error ? error.message : 'Unknown error' });
      return [];
    }
  }

  // Method to get log statistics
  public async getLogStats(days: number = 7): Promise<any[]> {
    try {
      // Simple aggregation instead of custom method
      const stats = await LogEntry.aggregate([
        {
          $match: {
            timestamp: {
              $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
            }
          }
        },
        {
          $group: {
            _id: '$level',
            count: { $sum: 1 }
          }
        }
      ]);
      return stats;
    } catch (error) {
      this.error('Failed to get log statistics', { action: 'get_log_stats', error: error instanceof Error ? error.message : 'Unknown error' });
      return [];
    }
  }
}

export const logger = new LoggerService();
export default logger;

