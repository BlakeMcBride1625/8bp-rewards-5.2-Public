import axios from 'axios';
import { logger } from './LoggerService';

class DiscordNotificationService {
  private botToken: string;
  private registrationChannelId: string;

  constructor() {
    this.botToken = process.env.DISCORD_TOKEN || '';
    this.registrationChannelId = process.env.REGISTRATION_CHANNEL_ID || '';
  }

  /**
   * Send a notification to Discord when a new user registers
   */
  async sendRegistrationNotification(eightBallPoolId: string, username: string, ip: string): Promise<void> {
    if (!this.botToken || !this.registrationChannelId) {
      logger.warn('Discord notification skipped - missing DISCORD_TOKEN or REGISTRATION_CHANNEL_ID', {
        action: 'discord_notification_skipped'
      });
      return;
    }

    try {
      const embed = {
        title: '🎉 New User Registration',
        description: `A new user has registered for the 8BP Rewards system!`,
        color: 0x00ff00, // Green color
        fields: [
          {
            name: '👤 Username',
            value: username,
            inline: true
          },
          {
            name: '🎱 8BP Account ID',
            value: eightBallPoolId,
            inline: true
          },
          {
            name: '📍 IP Address',
            value: ip || 'Unknown',
            inline: true
          },
          {
            name: '📅 Registered At',
            value: new Date().toLocaleString(),
            inline: false
          }
        ],
        footer: {
          text: '8 Ball Pool Rewards System'
        },
        timestamp: new Date().toISOString()
      };

      await axios.post(
        `https://discord.com/api/v10/channels/${this.registrationChannelId}/messages`,
        {
          embeds: [embed]
        },
        {
          headers: {
            'Authorization': `Bot ${this.botToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('Discord registration notification sent', {
        action: 'discord_registration_notification',
        username,
        eightBallPoolId,
        channelId: this.registrationChannelId
      });
    } catch (error) {
      logger.error('Failed to send Discord registration notification', {
        action: 'discord_notification_error',
        error: error instanceof Error ? error.message : 'Unknown error',
        username,
        eightBallPoolId
      });
    }
  }
}

export default DiscordNotificationService;

