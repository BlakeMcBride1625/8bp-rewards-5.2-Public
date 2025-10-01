const { Client, GatewayIntentBits, AttachmentBuilder, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const DatabaseService = require('./services/database-service');

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
    this.specialUsers = this.getSpecialUsers();
    this.commands = new Collection();
    
    this.setupEventHandlers();
    this.setupSlashCommands();
  }

  // User mappings are now handled by DatabaseService

  getSpecialUsers() {
    const specialUsersEnv = process.env.DISCORD_SPECIAL_USERS;
    if (specialUsersEnv) {
      return specialUsersEnv.split(',').map(id => id.trim());
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

      // Check if user is in special users list
      const userId = interaction.user.id;
      const isSpecialUser = this.specialUsers.includes(userId);
      
      if (!isSpecialUser) {
        const errorMessage = '❌ Access denied! Only special users can use bot commands.';
        
        if (interaction.inGuild()) {
          return interaction.reply({
            content: errorMessage,
            ephemeral: true
          });
        } else {
          // In DM, just reply normally
          return interaction.reply({
            content: errorMessage
          });
        }
      }

      // Special users can use commands in both guilds and DMs
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
            ephemeral: interaction.inGuild() // Only use ephemeral in guilds, not DMs
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
    // Add 8BP ID command
    const addCommand = {
      data: new SlashCommandBuilder()
        .setName('add')
        .setDescription('Add a new 8 Ball Pool account ID for reward claiming')
        .addStringOption(option =>
          option.setName('bp_id')
            .setDescription('Your 8 Ball Pool account ID (e.g., 3417777776)')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('username')
            .setDescription('Choose a display name for this account (required)')
            .setRequired(true)),
      async execute(interaction, service) {
        const bpId = interaction.options.getString('bp_id');
        const username = interaction.options.getString('username');
        const discordId = interaction.user.id;

        // Validate input
        if (!bpId || !username) {
          return interaction.reply({
            content: '❌ Both 8BP ID and username are required!\n\n**Usage:** `/add bp_id:3417777776 username:YourName`',
            ephemeral: interaction.inGuild()
          });
        }

        try {
          // Use database service to add/update user
          const result = await service.dbService.addOrUpdateUser(discordId, bpId, username);
          
          if (!result.success) {
            return interaction.reply({
              content: `❌ Failed to add account: ${result.error}`,
              ephemeral: interaction.inGuild()
            });
          }

          // Get total user count
          const totalUsers = await service.dbService.getUserCount();

          const embed = new EmbedBuilder()
            .setTitle('✅ 8BP Account Added')
            .setDescription(`Successfully added your 8 Ball Pool account!${result.overrideMessage ? '\n\n' + result.overrideMessage : ''}`)
            .addFields(
              { name: '🎱 8BP Account ID', value: bpId, inline: true },
              { name: '👤 Username', value: username, inline: true },
              { name: '🆔 Discord ID', value: discordId, inline: true },
              { name: '📋 Total Accounts', value: `${totalUsers}`, inline: true }
            )
            .setColor(0x00FF00)
            .setTimestamp();

          await interaction.reply({ embeds: [embed], ephemeral: interaction.inGuild() });

        } catch (error) {
          console.error('❌ Error in /add command:', error);
          await interaction.reply({
            content: '❌ An error occurred while adding your account. Please try again.',
            ephemeral: interaction.inGuild()
          });
        }
      }
    };

    // Clear messages command
    const clearCommand = {
      data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clear messages in the current channel')
        .addIntegerOption(option =>
          option.setName('amount')
            .setDescription('Number of messages to delete (1-100)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)),
      async execute(interaction, service) {
        // Clear command only works in guilds, not DMs
        if (!interaction.inGuild()) {
          return interaction.reply({
            content: '❌ The `/clear` command can only be used in server channels, not in DMs.',
            ephemeral: false
          });
        }

        const amount = interaction.options.getInteger('amount');

        await interaction.deferReply({ ephemeral: true });

        try {
          const messages = await interaction.channel.messages.fetch({ limit: amount });
          const filtered = messages.filter(msg => !msg.pinned);

          if (filtered.size === 0) {
            return interaction.followUp({
              content: '❌ No messages to delete (excluding pinned messages)',
              ephemeral: true
            });
          }

          await interaction.channel.bulkDelete(filtered, true);

          const embed = new EmbedBuilder()
            .setTitle('🧹 Messages Cleared')
            .setDescription(`Successfully deleted **${filtered.size}** messages`)
            .setColor(0x00FF00)
            .setTimestamp();

          await interaction.followUp({ embeds: [embed], ephemeral: true });

        } catch (error) {
          console.error('Error clearing messages:', error);
          await interaction.followUp({
            content: '❌ Failed to clear messages. Make sure I have the "Manage Messages" permission.',
            ephemeral: true
          });
        }
      }
    };

    // List users command
    const listCommand = {
      data: new SlashCommandBuilder()
        .setName('list')
        .setDescription('List all registered 8 Ball Pool accounts'),
      async execute(interaction, service) {
        try {
          const users = await service.dbService.getAllUsers();
          
          if (users.length === 0) {
            return interaction.reply({
              content: '📋 No registered 8BP accounts found. Use `/add` to register your account.',
              ephemeral: interaction.inGuild()
            });
          }

          const embed = new EmbedBuilder()
            .setTitle('📋 Registered 8BP Accounts')
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
          console.error('❌ Error in /list command:', error);
          await interaction.reply({
            content: '❌ An error occurred while fetching accounts. Please try again.',
            ephemeral: interaction.inGuild()
          });
        }
      }
    };

    // Remove user command
    const removeCommand = {
      data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove your 8 Ball Pool account from the system')
        .addStringOption(option =>
          option.setName('bp_id')
            .setDescription('Your 8 Ball Pool account ID to remove')
            .setRequired(true)),
      async execute(interaction, service) {
        const bpId = interaction.options.getString('bp_id');
        const discordId = interaction.user.id;

        try {
          // Check if user owns this account
          const user = await service.dbService.getUserByDiscordId(discordId);
          
          if (!user || user.bpAccountId !== bpId) {
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
          console.error('❌ Error in /remove command:', error);
          await interaction.reply({
            content: '❌ An error occurred while removing your account. Please try again.',
            ephemeral: interaction.inGuild()
          });
        }
      }
    };

    // Manual claim command
    const claimCommand = {
      data: new SlashCommandBuilder()
        .setName('claim')
        .setDescription('Manually trigger reward claiming for your account'),
      async execute(interaction, service) {
        const discordId = interaction.user.id;

        try {
          const userMapping = await service.dbService.getUserByDiscordId(discordId);

          if (!userMapping) {
            return interaction.reply({
              content: '❌ You need to register your 8BP account first! Use `/add` command.',
              ephemeral: interaction.inGuild()
            });
          }

          await interaction.deferReply({ ephemeral: interaction.inGuild() });

          // Import the claimer dynamically to avoid circular dependencies
          const EightBallPoolClaimer = require('./playwright-claimer-discord');
          const claimer = new EightBallPoolClaimer();
          
          const result = await claimer.claimRewardsForUser(userMapping.bpAccountId);
          
          if (result.success) {
            // Update claim statistics
            await service.dbService.updateClaimStats(discordId);
            
            const embed = new EmbedBuilder()
              .setTitle('🎁 Manual Claim Complete')
              .setDescription(`Reward claiming completed for ${userMapping.username}`)
              .addFields(
                { name: '🎱 8BP Account ID', value: userMapping.bpAccountId, inline: true },
                { name: '✅ Items Claimed', value: result.claimedItems.length > 0 ? result.claimedItems.join(', ') : 'No new items available', inline: false }
              )
              .setColor(0x00FF00)
              .setTimestamp();

            await interaction.followUp({ embeds: [embed] });
          } else {
            await interaction.followUp({
              content: `❌ Claiming failed: ${result.error}`,
              ephemeral: interaction.inGuild()
            });
          }
        } catch (error) {
          console.error('Error in manual claim:', error);
          await interaction.followUp({
            content: '❌ An error occurred during manual claiming.',
            ephemeral: interaction.inGuild()
          });
        }
      }
    };

    // Get rewards command
    const getCommand = {
      data: new SlashCommandBuilder()
        .setName('get')
        .setDescription('Claim rewards for a specific 8 Ball Pool account ID')
        .addStringOption(option =>
          option.setName('bp_id')
            .setDescription('The 8 Ball Pool account ID to claim rewards for')
            .setRequired(true)),
      async execute(interaction, service) {
        const bpId = interaction.options.getString('bp_id');
        const discordId = interaction.user.id;

        // Check if the user owns this 8BP ID or if they're trying to claim for someone else
        const userMapping = service.userMappings.find(mapping => 
          mapping.discordId === discordId && mapping.bpAccountId === bpId
        );

        const targetUserMapping = service.userMappings.find(mapping => 
          mapping.bpAccountId === bpId
        );

        if (!userMapping && targetUserMapping) {
          return interaction.reply({
            content: `❌ You can only claim rewards for your own 8BP account! This ID belongs to ${targetUserMapping.username}.`,
            ephemeral: interaction.inGuild()
          });
        }

        if (!targetUserMapping) {
          return interaction.reply({
            content: `❌ 8BP account ID ${bpId} is not registered in the system. Use \`/add\` to register it first.`,
            ephemeral: interaction.inGuild()
          });
        }

        await interaction.deferReply({ ephemeral: interaction.inGuild() });

        try {
          // Import the claimer dynamically to avoid circular dependencies
          const EightBallPoolClaimer = require('./playwright-claimer-discord');
          const claimer = new EightBallPoolClaimer();
          
          const result = await claimer.claimRewardsForUser(bpId);
          
          if (result.success) {
            const embed = new EmbedBuilder()
              .setTitle('🎁 Manual Claim Complete')
              .setDescription(`Reward claiming completed for ${targetUserMapping.username}`)
              .addFields(
                { name: '🎱 8BP Account ID', value: bpId, inline: true },
                { name: '👤 Username', value: targetUserMapping.username, inline: true },
                { name: '✅ Items Claimed', value: result.claimedItems.length > 0 ? result.claimedItems.join(', ') : 'No new items available', inline: false },
                { name: '📸 Screenshot', value: result.screenshotPath ? `Saved as: ${result.screenshotPath}` : 'No screenshot available', inline: false }
              )
              .setColor(0x00FF00)
              .setTimestamp();

            await interaction.followUp({ embeds: [embed] });

            // Send Discord confirmation if Discord service is ready
            if (service.isReady && result.screenshotPath) {
              console.log('📤 Sending Discord confirmation for manual claim...');
              await service.sendConfirmation(bpId, result.screenshotPath, result.claimedItems);
            }

          } else {
            const embed = new EmbedBuilder()
              .setTitle('❌ Claim Failed')
              .setDescription(`Failed to claim rewards for ${targetUserMapping.username}`)
              .addFields(
                { name: '🎱 8BP Account ID', value: bpId, inline: true },
                { name: '👤 Username', value: targetUserMapping.username, inline: true },
                { name: '❌ Error', value: result.error || 'Unknown error occurred', inline: false }
              )
              .setColor(0xFF0000)
              .setTimestamp();

            await interaction.followUp({ embeds: [embed] });
          }
        } catch (error) {
          console.error('Error in manual get claim:', error);
          await interaction.followUp({
            content: '❌ An error occurred during manual claiming.',
            ephemeral: interaction.inGuild()
          });
        }
      }
    };

    // README/Markdown command
    const mdCommand = {
      data: new SlashCommandBuilder()
        .setName('md')
        .setDescription('Display README documentation and setup information'),
      async execute(interaction, service) {
        const embed = new EmbedBuilder()
          .setTitle('📖 8BP Reward Bot Documentation')
          .setDescription('Complete setup and usage guide')
          .addFields(
            { name: '🚀 Quick Start', value: '1. Set up Discord bot (follow DISCORD_SETUP.md)\n2. Add Discord tokens to .env\n3. Run `npm run bot`\n4. Use `/add` to register 8BP accounts', inline: false },
            { name: '⚙️ Configuration', value: '**Required .env variables:**\n• DISCORD_TOKEN\n• DISCORD_CHANNEL_ID\n• DISCORD_GUILD_ID\n• DISCORD_SPECIAL_USERS\n• USER_IDS (8BP account IDs)', inline: false },
            { name: '🤖 Available Commands', value: '• `/add bp_id:3417777776 username:YourName` - Register 8BP account\n• `/list` - View all accounts\n• `/remove` - Remove account\n• `/claim` - Manual claim (your account)\n• `/get` - Claim specific account\n• `/clear` - Delete messages\n• `/help` - Show commands\n• `/md` - Show this documentation', inline: false },
            { name: '⏰ Automation', value: '• **Daily Schedule**: 12:00 AM & 12:00 PM\n• **Auto Claims**: Daily rewards + cue pieces\n• **Discord Confirmations**: Screenshots + details\n• **File Cleanup**: Auto-deletes local files', inline: false },
            { name: '🔒 Security', value: '• **Access Control**: Special users only\n• **User Isolation**: Can only manage own accounts\n• **Permission Checks**: Validates ownership\n• **Error Handling**: Comprehensive logging', inline: false },
            { name: '📋 User Types', value: '• **Special Users**: DMs + channel posts + commands\n• **Regular Users**: Channel posts only\n• **All Users**: Permanent image storage in Discord', inline: false }
          )
          .addFields(
            { name: '🛠️ Technical Details', value: '• **Browser**: Playwright automation\n• **Language**: Node.js + Discord.js\n• **Storage**: JSON file for user mappings\n• **Scheduling**: node-cron for daily runs\n• **Images**: Auto-generated confirmations', inline: false },
            { name: '📁 File Structure', value: '• `playwright-claimer-discord.js` - Main automation\n• `discord-service.js` - Bot commands\n• `user-mapping.json` - Account storage\n• `image-generator.js` - Screenshot handling\n• `.env` - Configuration', inline: false },
            { name: '🔧 Commands', value: '• `npm run bot` - Start Discord bot\n• `npm run claim-discord` - Manual run\n• `npm run schedule-discord` - Scheduled runs\n• `npm run test-discord` - Test integration', inline: false }
          )
          .setColor(0x0099FF)
          .setFooter({ text: '8 Ball Pool Reward Bot v1.0.0' })
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: interaction.inGuild() });
      }
    };

    // Help command
    const helpCommand = {
      data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show available commands and how to use the bot'),
      async execute(interaction, service) {
        const embed = new EmbedBuilder()
          .setTitle('🤖 8BP Reward Bot Help')
          .setDescription('Here are all available commands:')
          .addFields(
            { name: '/add', value: 'Register your 8 Ball Pool account ID for automatic reward claiming\n**Usage:** `/add bp_id:3417777776 username:YourName`\n**Note:** Overrides any existing accounts with the same 8BP ID or Discord user', inline: false },
            { name: '/list', value: 'View all registered 8BP accounts', inline: false },
            { name: '/remove', value: 'Remove your 8BP account from the system', inline: false },
            { name: '/claim', value: 'Manually trigger reward claiming for your account', inline: false },
            { name: '/get', value: 'Claim rewards for a specific 8BP account ID', inline: false },
            { name: '/clear', value: 'Clear messages in current channel (1-100 messages)', inline: false },
            { name: '/md', value: 'Display complete README documentation and setup guide', inline: false },
            { name: '/help', value: 'Show this help message', inline: false }
          )
          .addFields(
            { name: '📋 How it works:', value: '1. Use `/add` to register your 8BP ID\n2. Bot automatically claims rewards daily at 12AM & 12PM\n3. You\'ll receive Discord confirmations with screenshots\n4. Special users get DMs + channel posts, others get channel posts only', inline: false },
            { name: '🔒 Access Control:', value: 'All commands are restricted to special users only (defined in DISCORD_SPECIAL_USERS)', inline: false }
          )
          .setColor(0x0099FF)
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: interaction.inGuild() });
      }
    };

    // Store commands
    this.commands.set('add', addCommand);
    this.commands.set('clear', clearCommand);
    this.commands.set('list', listCommand);
    this.commands.set('remove', removeCommand);
    this.commands.set('claim', claimCommand);
    this.commands.set('get', getCommand);
    this.commands.set('md', mdCommand);
    this.commands.set('help', helpCommand);
  }

  async registerSlashCommands() {
    try {
      const guildId = process.env.DISCORD_GUILD_ID;
      
      if (guildId) {
        // Register commands for specific guild (faster, for development)
        const guild = this.client.guilds.cache.get(guildId);
        if (guild) {
          await guild.commands.set(Array.from(this.commands.values()).map(cmd => cmd.data));
          console.log(`✅ Registered ${this.commands.size} slash commands for guild ${guild.name}`);
        }
      } else {
        // Register commands globally (slower, but works everywhere)
        await this.client.application.commands.set(Array.from(this.commands.values()).map(cmd => cmd.data));
        console.log(`✅ Registered ${this.commands.size} slash commands globally`);
      }
    } catch (error) {
      console.error('❌ Error registering slash commands:', error);
    }
  }

  // User mappings are now saved automatically by DatabaseService

  async sendConfirmation(bpAccountId, imagePath, claimedItems = []) {
    if (!this.isReady) {
      console.log('⚠️ Discord bot not ready, skipping confirmation');
      return false;
    }

    try {
      // Find user mapping in database
      const userMapping = await this.dbService.getUserByBpAccountId(bpAccountId);
      if (!userMapping) {
        console.log(`⚠️ No Discord mapping found for 8BP account: ${bpAccountId}`);
        return false;
      }

      const discordId = userMapping.discordId;
      const username = userMapping.username || 'Unknown User';
      const isSpecialUser = this.specialUsers.includes(discordId);

      // Create confirmation message
      const message = this.createConfirmationMessage(bpAccountId, username, claimedItems);
      
      // Create image attachment
      const imageAttachment = new AttachmentBuilder(imagePath, {
        name: `8bp-claim-${bpAccountId}.png`,
        description: `8 Ball Pool claim confirmation for account ${bpAccountId}`
      });

      // Send to channel first
      const channelSent = await this.sendToChannel(message, imageAttachment);
      
      // Send DM if special user
      let dmSent = false;
      if (isSpecialUser) {
        dmSent = await this.sendDirectMessage(discordId, message, imageAttachment);
      }

      // Delete local file after successful sending
      if (channelSent || dmSent) {
        this.deleteLocalFile(imagePath);
      }

      console.log(`✅ Discord confirmation sent for ${username} (${bpAccountId})`);
      if (isSpecialUser) {
        console.log(`📩 DM sent to special user: ${username}`);
      }
      
      return true;

    } catch (error) {
      console.error(`❌ Error sending Discord confirmation for ${bpAccountId}:`, error.message);
      return false;
    }
  }

  createConfirmationMessage(bpAccountId, username, claimedItems) {
    const timestamp = new Date().toLocaleString('en-GB', {
      timeZone: 'Europe/London',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    let message = `🎱 **8 Ball Pool Reward Claimed!**\n\n`;
    message += `**Account:** ${bpAccountId}\n`;
    message += `**User:** ${username}\n`;
    message += `**Time:** ${timestamp}\n\n`;

    if (claimedItems.length > 0) {
      message += `**Claimed Items:**\n`;
      claimedItems.forEach(item => {
        message += `• ${item}\n`;
      });
      message += `\n`;
    } else {
      message += `**Status:** No new items available to claim (may have already been claimed today)\n\n`;
    }

    message += `🖼️ See attached image for details.`;

    return message;
  }

  async sendToChannel(message, imageAttachment) {
    try {
      const channelId = process.env.DISCORD_CHANNEL_ID;
      if (!channelId) {
        console.log('⚠️ No Discord channel ID provided');
        return false;
      }

      const channel = await this.client.channels.fetch(channelId);
      if (!channel) {
        console.log('⚠️ Discord channel not found');
        return false;
      }

      await channel.send({
        content: message,
        files: [imageAttachment]
      });

      console.log('✅ Message sent to Discord channel');
      return true;

    } catch (error) {
      console.error('❌ Error sending to Discord channel:', error.message);
      return false;
    }
  }

  async sendDirectMessage(discordId, message, imageAttachment) {
    try {
      const user = await this.client.users.fetch(discordId);
      if (!user) {
        console.log(`⚠️ Discord user not found: ${discordId}`);
        return false;
      }

      await user.send({
        content: message,
        files: [imageAttachment]
      });

      console.log(`✅ DM sent to Discord user: ${user.tag}`);
      return true;

    } catch (error) {
      console.error(`❌ Error sending DM to ${discordId}:`, error.message);
      return false;
    }
  }

  deleteLocalFile(imagePath) {
    try {
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log(`🗑️ Deleted local file: ${path.basename(imagePath)}`);
      }
    } catch (error) {
      console.error(`⚠️ Error deleting local file ${imagePath}:`, error.message);
    }
  }

  async logout() {
    if (this.client) {
      await this.client.destroy();
      console.log('🔒 Discord bot logged out');
    }
    
    // Disconnect from database
    if (this.dbService) {
      await this.dbService.disconnect();
    }
  }
}

module.exports = DiscordService;
