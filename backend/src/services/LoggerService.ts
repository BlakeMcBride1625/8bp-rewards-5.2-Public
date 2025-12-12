import winston from 'winston';
import { Pool } from 'pg';

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
  private dbPool: Pool | null = null;

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

    // MongoDB transport disabled for PostgreSQL migration
    this.initDatabaseConnection();
  }

  private async initDatabaseConnection(): Promise<void> {
    try {
      // Reduced pool size for logger (separate pool needed to avoid circular dependency with DatabaseService)
      this.dbPool = new Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_DB || '8bp_rewards',
        user: process.env.POSTGRES_USER || 'admin',
        password: process.env.POSTGRES_PASSWORD || '',
        ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
        // Minimized pool for logging only (reduced from max:20 to max:3)
        max: 3,
        min: 1,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
      });
      this.isConnected = true;
      console.log('✅ Logger database connection initialized with minimal pooling');
    } catch (error) {
      console.error('❌ Failed to initialize logger database connection:', error);
      this.isConnected = false;
    }
  }

  private async logToDatabase(level: string, message: string, meta: LogMeta = {}): Promise<void> {
    if (!this.isConnected || !this.dbPool) {
      return;
    }

    try {
      await this.dbPool.query(
        'INSERT INTO log_entries (timestamp, level, message, service, metadata) VALUES ($1, $2, $3, $4, $5)',
        [new Date(), level, message, '8bp-rewards', JSON.stringify(meta)]
      );
    } catch (error) {
      console.error('❌ Failed to log to database:', error);
    }
  }

  public info(message: string, meta: LogMeta = {}): void {
    this.logger.info(message, meta);
    this.logToDatabase('info', message, meta);
  }

  public warn(message: string, meta: LogMeta = {}): void {
    this.logger.warn(message, meta);
    this.logToDatabase('warn', message, meta);
  }

  public error(message: string, meta: LogMeta = {}): void {
    this.logger.error(message, meta);
    this.logToDatabase('error', message, meta);
  }

  public debug(message: string, meta: LogMeta = {}): void {
    this.logger.debug(message, meta);
    this.logToDatabase('debug', message, meta);
  }

  // Specific logging methods for different actions
  public logClaim(eightBallPoolId: string, username: string, items: string[], success: boolean, ip?: string): void {
    const status = success ? 'success' : 'failed';
    this.info(`Claim ${status}: ${username} (${eightBallPoolId}) - Items: ${items.join(', ')}`, {
      action: 'claim',
      userId: eightBallPoolId,
      username,
      items,
      success,
      ip
    });
  }

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

  // MongoDB query methods disabled for PostgreSQL migration
  public async getLogs(page: number = 1, limit: number = 50, filters: any = {}): Promise<any[]> {
    // Return empty array since MongoDB logging is disabled
    return [];
  }

  public async getLogStats(days: number = 7): Promise<any[]> {
    // Return empty array since MongoDB logging is disabled
    return [];
  }
}

export const logger = new LoggerService();
export default logger;

