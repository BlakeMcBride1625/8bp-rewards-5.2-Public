import cron from 'node-cron';
import { logger } from './LoggerService';
import { Registration } from '../models/Registration';
import { ClaimRecord } from '../models/ClaimRecord';
import DiscordService from '../../discord-service';

interface ClaimResult {
  eightBallPoolId: string;
  websiteUserId: string;
  status: 'success' | 'failed';
  itemsClaimed?: string[];
  error?: string;
}

interface SchedulerSummary {
  timestampUTC: string;
  totalAttempted: number;
  totalSucceeded: number;
  totalFailed: number;
  perUser: ClaimResult[];
}

class SchedulerService {
  private discordService: DiscordService;
  private isRunning: boolean = false;
  private lastRun: Date | null = null;
  private nextRun: Date | null = null;

  constructor() {
    this.discordService = new DiscordService();
    this.setupScheduler();
  }

  private setupScheduler(): void {
    // Schedule runs at 00:00, 06:00, 12:00, 18:00 UTC
    const cronExpression = '0 0,6,12,18 * * *';
    
    cron.schedule(cronExpression, async () => {
      await this.runScheduledClaim();
    }, {
      timezone: 'UTC'
    });

    // Calculate next run time
    this.calculateNextRun();
    
    logger.info('Scheduler initialized', {
      action: 'scheduler_init',
      schedule: '00:00, 06:00, 12:00, 18:00 UTC',
      nextRun: this.nextRun?.toISOString()
    });
  }

  private calculateNextRun(): void {
    const now = new Date();
    const utcHours = [0, 6, 12, 18]; // Scheduled hours in UTC
    
    let nextRun = new Date(now);
    nextRun.setUTCHours(0, 0, 0, 0); // Start from midnight UTC
    
    // Find next scheduled hour
    for (const hour of utcHours) {
      const scheduledTime = new Date(now);
      scheduledTime.setUTCHours(hour, 0, 0, 0);
      
      if (scheduledTime > now) {
        nextRun = scheduledTime;
        break;
      }
    }
    
    // If no time found today, set to midnight tomorrow
    if (nextRun <= now) {
      nextRun = new Date(now);
      nextRun.setUTCDate(nextRun.getUTCDate() + 1);
      nextRun.setUTCHours(0, 0, 0, 0);
    }
    
    this.nextRun = nextRun;
  }

  public async runScheduledClaim(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Scheduler run already in progress, skipping', {
        action: 'scheduler_skip'
      });
      return;
    }

    this.isRunning = true;
    this.lastRun = new Date();
    
    logger.info('Starting scheduled claim run', {
      action: 'scheduler_start',
      timestamp: this.lastRun.toISOString()
    });

    try {
      // Get all registered users
      const registrations = await Registration.getAllRegistrations();
      
      if (registrations.length === 0) {
        logger.info('No registered users found for scheduled claim', {
          action: 'scheduler_no_users'
        });
        return;
      }

      const results: ClaimResult[] = [];
      
      // Process each user
      for (const registration of registrations) {
        try {
          const result = await this.claimRewardsForUser(registration);
          results.push(result);
          
          // Log the claim record
          await this.logClaimRecord(registration, result);
          
        } catch (error) {
          logger.error('Failed to claim rewards for user', {
            action: 'scheduler_user_error',
            eightBallPoolId: registration.eightBallPoolId,
            error: error.message
          });
          
          results.push({
            eightBallPoolId: registration.eightBallPoolId,
            websiteUserId: registration.username,
            status: 'failed',
            error: error.message
          });
        }
      }

      // Create summary
      const summary: SchedulerSummary = {
        timestampUTC: this.lastRun.toISOString(),
        totalAttempted: results.length,
        totalSucceeded: results.filter(r => r.status === 'success').length,
        totalFailed: results.filter(r => r.status === 'failed').length,
        perUser: results
      };

      // Log summary
      logger.logSchedulerRun(summary.totalAttempted, summary.totalSucceeded, summary.totalFailed);

      // Send Discord notification
      await this.discordService.sendSchedulerSummary(summary);

      // Send failure notifications if there were failures
      if (summary.totalFailed > 0) {
        const failureMessage = `Scheduler run completed with ${summary.totalFailed} failures out of ${summary.totalAttempted} attempts`;
        await this.discordService.sendFailureNotification(failureMessage);
      }

      logger.info('Scheduled claim run completed', {
        action: 'scheduler_complete',
        summary
      });

    } catch (error) {
      logger.error('Scheduled claim run failed', {
        action: 'scheduler_error',
        error: error.message
      });

      // Send failure notification
      await this.discordService.sendFailureNotification(
        `Scheduler run failed: ${error.message}`
      );
    } finally {
      this.isRunning = false;
      this.calculateNextRun();
    }
  }

  private async claimRewardsForUser(registration: any): Promise<ClaimResult> {
    try {
      // This would integrate with the existing Playwright claimer
      // For now, simulate the claim process
      
      // Import the claimer dynamically to avoid circular dependencies
      const EightBallPoolClaimer = require('../playwright-claimer-discord');
      const claimer = new EightBallPoolClaimer();
      
      const result = await claimer.claimRewardsForUser(registration.eightBallPoolId);
      
      return {
        eightBallPoolId: registration.eightBallPoolId,
        websiteUserId: registration.username,
        status: result.success ? 'success' : 'failed',
        itemsClaimed: result.success ? result.claimedItems : undefined,
        error: result.success ? undefined : result.error
      };

    } catch (error) {
      return {
        eightBallPoolId: registration.eightBallPoolId,
        websiteUserId: registration.username,
        status: 'failed',
        error: error.message
      };
    }
  }

  private async logClaimRecord(registration: any, result: ClaimResult): Promise<void> {
    try {
      const claimRecord = new ClaimRecord({
        eightBallPoolId: registration.eightBallPoolId,
        websiteUserId: registration.username,
        status: result.status,
        itemsClaimed: result.itemsClaimed || [],
        error: result.error,
        claimedAt: new Date(),
        schedulerRun: this.lastRun!
      });

      await claimRecord.save();
    } catch (error) {
      logger.error('Failed to log claim record', {
        action: 'log_claim_record_error',
        eightBallPoolId: registration.eightBallPoolId,
        error: error.message
      });
    }
  }

  public getStatus(): any {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun?.toISOString(),
      nextRun: this.nextRun?.toISOString(),
      schedule: '00:00, 06:00, 12:00, 18:00 UTC',
      timezone: 'UTC'
    };
  }

  public async triggerManualRun(): Promise<void> {
    logger.info('Manual scheduler run triggered', {
      action: 'manual_scheduler_trigger'
    });
    
    await this.runScheduledClaim();
  }
}

export default SchedulerService;


