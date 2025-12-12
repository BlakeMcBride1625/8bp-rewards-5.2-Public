import { logger } from './LoggerService';
import { DeviceInfo } from './DeviceDetectionService';
import { DatabaseService } from './DatabaseService';

export interface BlockedDevice {
  id: string;
  ipAddress?: string;
  deviceId?: string;
  deviceType?: string;
  userAgent?: string;
  eightBallPoolId?: string;
  username?: string;
  blockedAt: Date;
  blockedBy: string;
  reason?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class BlockingService {
  private static instance: BlockingService;
  private dbService: DatabaseService;

  private constructor() {
    this.dbService = DatabaseService.getInstance();
  }

  public static getInstance(): BlockingService {
    if (!BlockingService.instance) {
      BlockingService.instance = new BlockingService();
    }
    return BlockingService.instance;
  }

  /**
   * Block a device/user with comprehensive tracking
   */
  public async blockDevice(
    deviceInfo: DeviceInfo,
    ip: string,
    eightBallPoolId?: string,
    username?: string,
    blockedBy: string = 'admin',
    reason?: string
  ): Promise<BlockedDevice> {
    try {
      const sql = `
        INSERT INTO blocked_devices (
          ip_address, device_id, device_type, user_agent, 
          eight_ball_pool_id, username, blocked_by, reason, 
          is_active, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `;
      
      const values = [
        ip,
        deviceInfo.deviceId,
        deviceInfo.deviceType,
        deviceInfo.userAgent,
        eightBallPoolId,
        username,
        blockedBy,
        reason || 'Blocked by admin',
        true
      ];

      const result = await this.dbService.executeQuery(sql, values);
      const row = result.rows[0];
      
      const blockedDevice: BlockedDevice = {
        id: row.id,
        ipAddress: row.ip_address,
        deviceId: row.device_id,
        deviceType: row.device_type,
        userAgent: row.user_agent,
        eightBallPoolId: row.eight_ball_pool_id,
        username: row.username,
        blockedAt: row.blocked_at,
        blockedBy: row.blocked_by,
        reason: row.reason,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };

      logger.info('Device blocked successfully', {
        action: 'device_blocked',
        blockedDeviceId: blockedDevice.id,
        ip,
        deviceId: deviceInfo.deviceId.substring(0, 8) + '...',
        deviceType: deviceInfo.deviceType,
        eightBallPoolId,
        username,
        blockedBy,
        reason
      });

      return blockedDevice;
    } catch (error) {
      logger.error('Failed to block device', {
        action: 'block_device_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        ip,
        deviceId: deviceInfo.deviceId.substring(0, 8) + '...',
        eightBallPoolId,
        username
      });
      throw error;
    }
  }

  /**
   * Check if a device/IP is blocked
   */
  public async isBlocked(deviceInfo: DeviceInfo, ip: string): Promise<BlockedDevice | null> {
    try {
      const sql = `
        SELECT * FROM blocked_devices 
        WHERE is_active = true 
        AND (
          ip_address = $1 
          OR device_id = $2 
          OR (device_type = $3 AND user_agent = $4)
        )
        ORDER BY blocked_at DESC
        LIMIT 1
      `;
      
      const values = [ip, deviceInfo.deviceId, deviceInfo.deviceType, deviceInfo.userAgent];
      const result = await this.dbService.executeQuery(sql, values);
      
      if (result.rows.length > 0) {
        logger.info('Blocked device detected', {
          action: 'blocked_device_detected',
          ip,
          deviceId: deviceInfo.deviceId.substring(0, 8) + '...',
          deviceType: deviceInfo.deviceType,
          blockedAt: result.rows[0].blocked_at,
          reason: result.rows[0].reason
        });
        
        return result.rows[0];
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to check if device is blocked', {
        action: 'check_blocked_device_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        ip,
        deviceId: deviceInfo.deviceId.substring(0, 8) + '...'
      });
      return null;
    }
  }

  /**
   * Unblock a device
   */
  public async unblockDevice(blockedDeviceId: string, unblockedBy: string = 'admin'): Promise<boolean> {
    try {
      const sql = `
        UPDATE blocked_devices 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;
      
      const result = await this.dbService.executeQuery(sql, [blockedDeviceId]);
      
      if (result.rows.length > 0) {
        logger.info('Device unblocked successfully', {
          action: 'device_unblocked',
          blockedDeviceId,
          unblockedBy,
          ip: result.rows[0].ip_address,
          deviceId: result.rows[0].device_id?.substring(0, 8) + '...'
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Failed to unblock device', {
        action: 'unblock_device_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        blockedDeviceId,
        unblockedBy
      });
      return false;
    }
  }

  /**
   * Get all blocked devices
   */
  public async getBlockedDevices(limit: number = 50, offset: number = 0): Promise<BlockedDevice[]> {
    try {
      const sql = `
        SELECT * FROM blocked_devices 
        ORDER BY blocked_at DESC
        LIMIT $1 OFFSET $2
      `;
      
      const result = await this.dbService.executeQuery(sql, [limit, offset]);
      return result.rows.map((row: any) => ({
        id: row.id,
        ipAddress: row.ip_address,
        deviceId: row.device_id,
        deviceType: row.device_type,
        userAgent: row.user_agent,
        eightBallPoolId: row.eight_ball_pool_id,
        username: row.username,
        blockedAt: row.blocked_at,
        blockedBy: row.blocked_by,
        reason: row.reason,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      logger.error('Failed to get blocked devices', {
        action: 'get_blocked_devices_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Get blocked devices count
   */
  public async getBlockedDevicesCount(): Promise<number> {
    try {
      const sql = 'SELECT COUNT(*) as count FROM blocked_devices WHERE is_active = true';
      const result = await this.dbService.executeQuery(sql);
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Failed to get blocked devices count', {
        action: 'get_blocked_devices_count_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }

  /**
   * Block user by eightBallPoolId (blocks all their devices)
   */
  public async blockUserByEightBallPoolId(
    eightBallPoolId: string,
    blockedBy: string = 'admin',
    reason?: string
  ): Promise<BlockedDevice[]> {
    try {
      // First, get all device info for this user
      const userSql = 'SELECT * FROM registrations WHERE eight_ball_pool_id = $1';
      const userResult = await this.dbService.executeQuery(userSql, [eightBallPoolId]);
      
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const user = userResult.rows[0];
      const blockedDevices: BlockedDevice[] = [];
      
      // Block each device associated with this user
      for (const registration of userResult.rows) {
        if (registration.device_id || registration.registration_ip) {
          const deviceInfo = {
            deviceId: registration.device_id || 'unknown',
            deviceType: registration.device_type || 'Unknown Device',
            platform: 'Unknown',
            browser: 'Unknown',
            userAgent: registration.user_agent || 'Unknown'
          };
          
          const blockedDevice = await this.blockDevice(
            deviceInfo,
            registration.registration_ip || 'unknown',
            eightBallPoolId,
            registration.username,
            blockedBy,
            reason || `User ${eightBallPoolId} blocked`
          );
          
          blockedDevices.push(blockedDevice);
        }
      }
      
      logger.info('User blocked successfully', {
        action: 'user_blocked',
        eightBallPoolId,
        username: user.username,
        blockedDevicesCount: blockedDevices.length,
        blockedBy,
        reason
      });
      
      return blockedDevices;
    } catch (error) {
      logger.error('Failed to block user', {
        action: 'block_user_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        eightBallPoolId,
        blockedBy
      });
      throw error;
    }
  }
}
