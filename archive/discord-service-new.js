const { Client, GatewayIntentBits, AttachmentBuilder, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const DatabaseService = require('./services/database-service');
const axios = require('axios');

class DiscordService {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages
      ]
    });
    
    this.isReady = false;
    this.dbService = new DatabaseService();
    this.allowedAdmins = this.getAllowedAdmins();
    this.commands = new Collection();
    
    this.setupEventHandlers();
    this.setupSlashCommands();
  }

  getAllowedAdmins() {
    const allowedAdminsEnv = process.env.ALLOWED_ADMINS;
    if (allowedAdminsEnv) {
      return allowedAdminsEnv.split(',').map(id => id.trim());
    }
    return [];
  }

  setupEventHandlers() {
    this.client.once('ready', async () => {
      console.log('🤖 Discord bot is ready!');
      console.log(`📋 Logged in as: ${this.client.user.tag}`);
      this.isReady = true;
      
      // Register slash commands
      await this.registerSlashCommands();
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      
      const command = this.commands.get(interaction.commandName);
      if (!command) return;

      // Check if user is in allowed admins list
      const userId = interaction.user.id;
      const isAdmin = this.allowedAdmins.includes(userId);
      
      if (!isAdmin) {
        const errorMessage = '❌ Access denied! Only administrators can use bot commands.';
        
        if (interaction.inGuild()) {
          return interaction.reply({
            content: errorMessage,
            ephemeral: true
          });
        } else {
          return interaction.reply({
            content: errorMessage
          });
        }
      }

      try {
        await command.execute(interaction, this);
      } catch (error) {
        console.error(`❌ Error executing command ${interaction.commandName}:`, error);
        const errorMessage = '❌ There was an error while executing this command!';
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorMessage, ephemeral: interaction.inGuild() });
        } else {
          await interaction.reply({ 
            content: errorMessage, 
            ephemeral: interaction.inGuild()
          });
        }
      }
    });

    this.client.on('error', (error) => {
      console.error('❌ Discord bot error:', error);
    });
  }

  async login() {
    const token = process.env.DISCORD_TOKEN;
    if (!token) {
      console.log('⚠️ No Discord token provided, Discord features disabled');
      return false;
    }

    try {
      // Connect to database first
      console.log('📊 Connecting to database...');
      await this.dbService.connect();
      
      await this.client.login(token);
      // Wait for ready event
      await this.waitForReady();
      return true;
    } catch (error) {
      console.error('❌ Failed to login to Discord:', error.message);
      return false;
    }
  }

  waitForReady() {
    return new Promise((resolve) => {
      if (this.isReady) {
        resolve();
      } else {
        const checkReady = () => {
          if (this.isReady) {
            resolve();
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      }
    });
  }

  setupSlashCommands() {
    // Register command
    const registerCommand = {
      data: new SlashCommandBuilder()
        .setName('register')
        .setDescription('Register your 8 Ball Pool account for automated rewards')
        .addIntegerOption(option =>
          option.setName('eightballpoolid')
            .setDescription('Your 8 Ball Pool User ID')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('username')
            .setDescription('Your username')
            .setRequired(true)),
      async execute(interaction, service) {
        const eightBallPoolId = interaction.options.getInteger('eightballpoolid').toString();
        const username = interaction.options.getString('username');
        const discordId = interaction.user.id;

        try {
          // Use database service to add/update user
          const result = await service.dbService.addOrUpdateUser(discordId, eightBallPoolId, username);
          
          if (!result.success) {
            return interaction.reply({
              content: `❌ Failed to register account: ${result.error}`,
              ephemeral: interaction.inGuild()
            });
          }

          // Get total user count
          const totalUsers = await service.dbService.getUserCount();

          const embed = new EmbedBuilder()
            .setTitle('✅ Account Registered')
            .setDescription(`Successfully registered your 8 Ball Pool account!${result.overrideMessage ? '\n\n' + result.overrideMessage : ''}`)
            .addFields(
              { name: '🎱 8BP Account ID', value: eightBallPoolId, inline: true },
              { name: '👤 Username', value: username, inline: true },
              { name: '🆔 Discord ID', value: discordId, inline: true },
              { name: '📋 Total Accounts', value: `${totalUsers}`, inline: true }
            )
            .setColor(0x00FF00)
            .setTimestamp();

          await interaction.reply({ embeds: [embed], ephemeral: interaction.inGuild() });

        } catch (error) {
          console.error('❌ Error in /register command:', error);
          await interaction.reply({
            content: '❌ An error occurred while registering your account. Please try again.',
            ephemeral: interaction.inGuild()
          });
        }
      }
    };

    // List accounts command
    const listAccountsCommand = {
      data: new SlashCommandBuilder()
        .setName('list-accounts')
        .setDescription('List all registered accounts'),
      async execute(interaction, service) {
        try {
          const users = await service.dbService.getAllUsers();
          
          if (users.length === 0) {
            return interaction.reply({
              content: '📋 No registered accounts found.',
              ephemeral: interaction.inGuild()
            });
          }

          const embed = new EmbedBuilder()
            .setTitle('📋 Registered Accounts')
            .setDescription(`Total accounts: **${users.length}**`)
            .setColor(0x0099FF)
            .setTimestamp();

          users.forEach((user, index) => {
            embed.addFields({
              name: `${index + 1}. ${user.username}`,
              value: `🎱 **ID:** ${user.bpAccountId}\n🆔 **Discord:** <@${user.discordId}>\n📊 **Claims:** ${user.totalClaims || 0}`,
              inline: true
            });
          });

          await interaction.reply({ embeds: [embed], ephemeral: interaction.inGuild() });

        } catch (error) {
          console.error('❌ Error in /list-accounts command:', error);
          await interaction.reply({
            content: '❌ An error occurred while fetching accounts. Please try again.',
            ephemeral: interaction.inGuild()
          });
        }
      }
    };

    // Check accounts command
    const checkAccountsCommand = {
      data: new SlashCommandBuilder()
        .setName('check-accounts')
        .setDescription('Check the status of all registered accounts'),
      async execute(interaction, service) {
        try {
          await interaction.deferReply({ ephemeral: interaction.inGuild() });

          const users = await service.dbService.getAllUsers();
          
          if (users.length === 0) {
            return interaction.followUp({
              content: '📋 No registered accounts found.',
              ephemeral: interaction.inGuild()
            });
          }

          const embed = new EmbedBuilder()
            .setTitle('🔍 Account Status Check')
            .setDescription(`Checking status of **${users.length}** accounts...`)
            .setColor(0x0099FF)
            .setTimestamp();

          let statusText = '';
          users.forEach((user, index) => {
            const lastClaimed = user.lastClaimed 
              ? new Date(user.lastClaimed).toLocaleDateString()
              : 'Never';
            
            statusText += `${index + 1}. **${user.username}** (${user.bpAccountId})\n`;
            statusText += `   📊 Claims: ${user.totalClaims || 0} | Last: ${lastClaimed}\n\n`;
          });

          embed.setDescription(statusText);

          await interaction.followUp({ embeds: [embed] });

        } catch (error) {
          console.error('❌ Error in /check-accounts command:', error);
          await interaction.followUp({
            content: '❌ An error occurred while checking accounts. Please try again.',
            ephemeral: interaction.inGuild()
          });
        }
      }
    };

    // Deregister command
    const deregisterCommand = {
      data: new SlashCommandBuilder()
        .setName('deregister')
        .setDescription('Remove your account from the rewards system')
        .addIntegerOption(option =>
          option.setName('eightballpoolid')
            .setDescription('8 Ball Pool User ID to remove')
            .setRequired(true)),
      async execute(interaction, service) {
        const eightBallPoolId = interaction.options.getInteger('eightballpoolid').toString();
        const discordId = interaction.user.id;

        try {
          // Check if user owns this account
          const user = await service.dbService.getUserByDiscordId(discordId);
          
          if (!user || user.bpAccountId !== eightBallPoolId) {
            return interaction.reply({
              content: '❌ Account not found! Make sure you\'re using your correct 8BP ID.',
              ephemeral: interaction.inGuild()
            });
          }

          // Remove the user
          const result = await service.dbService.removeUserByDiscordId(discordId);
          
          if (!result.success) {
            return interaction.reply({
              content: `❌ Failed to remove account: ${result.error}`,
              ephemeral: interaction.inGuild()
            });
          }

          const embed = new EmbedBuilder()
            .setTitle('🗑️ Account Removed')
            .setDescription(`Successfully removed your 8 Ball Pool account`)
            .addFields(
              { name: '🎱 8BP Account ID', value: result.user.bpAccountId, inline: true },
              { name: '👤 Username', value: result.user.username, inline: true }
            )
            .setColor(0xFF0000)
            .setTimestamp();

          await interaction.reply({ embeds: [embed], ephemeral: interaction.inGuild() });

        } catch (error) {
          console.error('❌ Error in /deregister command:', error);
          await interaction.reply({
            content: '❌ An error occurred while removing your account. Please try again.',
            ephemeral: interaction.inGuild()
          });
        }
      }
    };

    // Help command
    const helpCommand = {
      data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show help information and available commands'),
      async execute(interaction, service) {
        const embed = new EmbedBuilder()
          .setTitle('🤖 8BP Rewards Bot - Help')
          .setDescription('Available commands for administrators:')
          .addFields(
            { name: '/register', value: 'Register your 8 Ball Pool account for automated rewards', inline: false },
            { name: '/list-accounts', value: 'List all registered accounts', inline: false },
            { name: '/check-accounts', value: 'Check the status of all registered accounts', inline: false },
            { name: '/deregister', value: 'Remove your account from the rewards system', inline: false },
            { name: '/help', value: 'Show this help message', inline: false },
            { name: '/md', value: 'Show markdown documentation', inline: false },
            { name: '/server-status', value: 'Check Discord bot server status', inline: false },
            { name: '/website-status', value: 'Check website and backend services status', inline: false },
            { name: '/ping-discord', value: 'Test Discord bot connectivity', inline: false },
            { name: '/ping-website', value: 'Test website connectivity', inline: false }
          )
          .setColor(0x0099FF)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: interaction.inGuild() });
      }
    };

    // Markdown documentation command
    const mdCommand = {
      data: new SlashCommandBuilder()
        .setName('md')
        .setDescription('Show markdown documentation'),
      async execute(interaction, service) {
        const embed = new EmbedBuilder()
          .setTitle('📚 8BP Rewards System Documentation')
          .setDescription('## Overview\n\nThe 8 Ball Pool Rewards System automatically claims daily rewards for registered users.\n\n## Features\n\n- 🎯 **Automated Claiming**: Claims rewards every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)\n- 🆔 **Multiple User Support**: Supports multiple registered accounts\n- 📝 **Comprehensive Logging**: All activities are logged\n- 🤖 **Discord Integration**: Notifications and admin commands\n- 🌐 **Web Interface**: Full admin dashboard and user registration\n\n## Registration\n\n1. Visit the website: https://8bp.epildevconnect.uk/8bp-rewards/register\n2. Enter your 8 Ball Pool User ID and username\n3. Your account will be automatically included in the reward claiming schedule\n\n## Admin Commands\n\nAll commands require administrator privileges.\n\n- `/register` - Register a new account\n- `/list-accounts` - List all registered accounts\n- `/check-accounts` - Check account statuses\n- `/deregister` - Remove an account\n- `/help` - Show help information\n- `/server-status` - Check bot server status\n- `/website-status` - Check website status\n\n## Support\n\nFor support, visit: https://8bp.epildevconnect.uk/8bp-rewards/contact')
          .setColor(0x0099FF)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: interaction.inGuild() });
      }
    };

    // Server status command
    const serverStatusCommand = {
      data: new SlashCommandBuilder()
        .setName('server-status')
        .setDescription('Check the status of the Discord bot server'),
      async execute(interaction, service) {
        try {
          const uptime = process.uptime();
          const memoryUsage = process.memoryUsage();
          
          const embed = new EmbedBuilder()
            .setTitle('🖥️ Discord Bot Server Status')
            .addFields(
              { name: '🟢 Status', value: 'Online', inline: true },
              { name: '⏱️ Uptime', value: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`, inline: true },
              { name: '💾 Memory', value: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`, inline: true },
              { name: '📊 Node.js', value: process.version, inline: true },
              { name: '🖥️ Platform', value: process.platform, inline: true },
              { name: '🆔 Bot ID', value: service.client.user.id, inline: true }
            )
            .setColor(0x00FF00)
            .setTimestamp();

          await interaction.reply({ embeds: [embed], ephemeral: interaction.inGuild() });

        } catch (error) {
          console.error('❌ Error in /server-status command:', error);
          await interaction.reply({
            content: '❌ An error occurred while checking server status.',
            ephemeral: interaction.inGuild()
          });
        }
      }
    };

    // Website status command
    const websiteStatusCommand = {
      data: new SlashCommandBuilder()
        .setName('website-status')
        .setDescription('Check the status of the website and backend services'),
      async execute(interaction, service) {
        try {
          await interaction.deferReply({ ephemeral: interaction.inGuild() });

          const baseUrl = process.env.PUBLIC_URL || 'https://8bp.epildevconnect.uk/8bp-rewards';
          
          // Check backend health
          let backendStatus = '❌ Unknown';
          let backendResponseTime = 'N/A';
          
          try {
            const startTime = Date.now();
            const response = await axios.get(`${baseUrl}/api/status`, { timeout: 5000 });
            const responseTime = Date.now() - startTime;
            
            if (response.status === 200) {
              backendStatus = '✅ Online';
              backendResponseTime = `${responseTime}ms`;
            }
          } catch (error) {
            backendStatus = '❌ Offline';
          }

          // Check database
          const dbHealth = await service.dbService.healthCheck();
          const dbStatus = dbHealth.connected ? '✅ Connected' : '❌ Disconnected';

          const embed = new EmbedBuilder()
            .setTitle('🌐 Website & Backend Status')
            .addFields(
              { name: '🌐 Website', value: '✅ Online', inline: true },
              { name: '🔧 Backend API', value: backendStatus, inline: true },
              { name: '📊 Database', value: dbStatus, inline: true },
              { name: '⏱️ Response Time', value: backendResponseTime, inline: true },
              { name: '👥 Registered Users', value: `${dbHealth.userCount || 0}`, inline: true },
              { name: '🔗 Website URL', value: baseUrl, inline: false }
            )
            .setColor(backendStatus.includes('✅') ? 0x00FF00 : 0xFF0000)
            .setTimestamp();

          await interaction.followUp({ embeds: [embed] });

        } catch (error) {
          console.error('❌ Error in /website-status command:', error);
          await interaction.followUp({
            content: '❌ An error occurred while checking website status.',
            ephemeral: interaction.inGuild()
          });
        }
      }
    };

    // Ping Discord command
    const pingDiscordCommand = {
      data: new SlashCommandBuilder()
        .setName('ping-discord')
        .setDescription('Test Discord bot connectivity'),
      async execute(interaction, service) {
        const sent = await interaction.reply({ 
          content: '🏓 Pinging...', 
          fetchReply: true,
          ephemeral: interaction.inGuild()
        });
        
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(service.client.ws.ping);

        const embed = new EmbedBuilder()
          .setTitle('🏓 Discord Bot Ping')
          .addFields(
            { name: '📡 Bot Latency', value: `${latency}ms`, inline: true },
            { name: '🌐 API Latency', value: `${apiLatency}ms`, inline: true }
          )
          .setColor(0x00FF00)
          .setTimestamp();

        await interaction.editReply({ content: '', embeds: [embed] });
      }
    };

    // Ping website command
    const pingWebsiteCommand = {
      data: new SlashCommandBuilder()
        .setName('ping-website')
        .setDescription('Test website connectivity'),
      async execute(interaction, service) {
        try {
          await interaction.deferReply({ ephemeral: interaction.inGuild() });

          const baseUrl = process.env.PUBLIC_URL || 'https://8bp.epildevconnect.uk/8bp-rewards';
          const startTime = Date.now();
          
          const response = await axios.get(`${baseUrl}/api/status`, { timeout: 10000 });
          const responseTime = Date.now() - startTime;

          const embed = new EmbedBuilder()
            .setTitle('🏓 Website Ping')
            .addFields(
              { name: '🌐 Website', value: baseUrl, inline: false },
              { name: '⏱️ Response Time', value: `${responseTime}ms`, inline: true },
              { name: '📊 Status Code', value: `${response.status}`, inline: true },
              { name: '🟢 Status', value: 'Online', inline: true }
            )
            .setColor(0x00FF00)
            .setTimestamp();

          await interaction.followUp({ embeds: [embed] });

        } catch (error) {
          const embed = new EmbedBuilder()
            .setTitle('🏓 Website Ping')
            .addFields(
              { name: '🌐 Website', value: process.env.PUBLIC_URL || 'https://8bp.epildevconnect.uk/8bp-rewards', inline: false },
              { name: '⏱️ Response Time', value: 'Timeout', inline: true },
              { name: '📊 Status', value: '❌ Offline', inline: true }
            )
            .setColor(0xFF0000)
            .setTimestamp();

          await interaction.followUp({ embeds: [embed] });
        }
      }
    };

    // Add all commands to collection
    this.commands.set('register', registerCommand);
    this.commands.set('list-accounts', listAccountsCommand);
    this.commands.set('check-accounts', checkAccountsCommand);
    this.commands.set('deregister', deregisterCommand);
    this.commands.set('help', helpCommand);
    this.commands.set('md', mdCommand);
    this.commands.set('server-status', serverStatusCommand);
    this.commands.set('website-status', websiteStatusCommand);
    this.commands.set('ping-discord', pingDiscordCommand);
    this.commands.set('ping-website', pingWebsiteCommand);
  }

  async registerSlashCommands() {
    try {
      const commands = Array.from(this.commands.values()).map(cmd => cmd.data.toJSON());
      
      // Register commands globally
      await this.client.application.commands.set(commands);
      
      console.log(`✅ Registered ${commands.length} slash commands globally`);
    } catch (error) {
      console.error('❌ Failed to register slash commands:', error);
    }
  }

  async logout() {
    if (this.client) {
      await this.client.destroy();
      console.log('🔒 Discord bot logged out');
    }
    
    if (this.dbService) {
      await this.dbService.disconnect();
    }
  }

  // Send notification to rewards channel
  async sendRewardsNotification(eightBallPoolId, websiteUserId, timestampUTC) {
    try {
      const channelId = process.env.REWARDS_CHANNEL_ID;
      if (!channelId) return false;

      const channel = this.client.channels.cache.get(channelId);
      if (!channel || !channel.isTextBased()) return false;

      const embed = new EmbedBuilder()
        .setTitle('🎁 New Registration')
        .setDescription('A new user has registered for automated rewards!')
        .addFields(
          { name: '🎱 8BP Account ID', value: eightBallPoolId, inline: true },
          { name: '👤 Website User ID', value: websiteUserId, inline: true },
          { name: '⏰ Registered At', value: timestampUTC, inline: true }
        )
        .setColor(0x00FF00)
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      return true;
    } catch (error) {
      console.error('❌ Failed to send rewards notification:', error);
      return false;
    }
  }

  // Send scheduler summary to scheduler channel
  async sendSchedulerSummary(summary) {
    try {
      const channelId = process.env.SCHEDULER_CHANNEL_ID;
      if (!channelId) return false;

      const channel = this.client.channels.cache.get(channelId);
      if (!channel || !channel.isTextBased()) return false;

      const embed = new EmbedBuilder()
        .setTitle('⏰ Scheduler Run Summary')
        .setDescription(`Automated reward claiming completed`)
        .addFields(
          { name: '📊 Total Attempted', value: summary.totalAttempted.toString(), inline: true },
          { name: '✅ Successful', value: summary.totalSucceeded.toString(), inline: true },
          { name: '❌ Failed', value: summary.totalFailed.toString(), inline: true },
          { name: '⏰ UTC Timestamp', value: summary.timestampUTC, inline: false }
        )
        .setColor(summary.totalFailed > 0 ? 0xFFA500 : 0x00FF00)
        .setTimestamp();

      // Add per-user details if provided
      if (summary.perUser && summary.perUser.length > 0) {
        let userDetails = '';
        summary.perUser.forEach((user, index) => {
          if (index < 10) { // Limit to first 10 users to avoid embed limits
            const status = user.status === 'success' ? '✅' : '❌';
            const items = user.itemsClaimed ? user.itemsClaimed.join(', ') : user.error || 'No items';
            userDetails += `${status} **${user.eightBallPoolId}** (${user.websiteUserId}): ${items}\n`;
          }
        });
        
        if (summary.perUser.length > 10) {
          userDetails += `... and ${summary.perUser.length - 10} more users`;
        }
        
        embed.addFields({ name: '👥 Per-User Results', value: userDetails, inline: false });
      }

      await channel.send({ embeds: [embed] });
      return true;
    } catch (error) {
      console.error('❌ Failed to send scheduler summary:', error);
      return false;
    }
  }

  // Send failure notification to all admins
  async sendFailureNotification(errorMessage) {
    try {
      for (const adminId of this.allowedAdmins) {
        try {
          const user = await this.client.users.fetch(adminId);
          if (user) {
            const embed = new EmbedBuilder()
              .setTitle('🚨 System Failure Alert')
              .setDescription('A critical error has occurred in the 8BP Rewards system')
              .addFields(
                { name: '❌ Error', value: errorMessage, inline: false },
                { name: '⏰ Timestamp', value: new Date().toISOString(), inline: false }
              )
              .setColor(0xFF0000)
              .setTimestamp();

            await user.send({ embeds: [embed] });
          }
        } catch (userError) {
          console.error(`❌ Failed to send DM to admin ${adminId}:`, userError);
        }
      }
      return true;
    } catch (error) {
      console.error('❌ Failed to send failure notifications:', error);
      return false;
    }
  }
}

module.exports = DiscordService;


