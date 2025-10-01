const DiscordService = require('./discord-service');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

class DiscordBot {
  constructor() {
    this.discordService = new DiscordService();
  }

  async start() {
    console.log('🚀 Starting Discord Bot...');
    
    try {
      const success = await this.discordService.login();
      
      if (success) {
        console.log('✅ Discord Bot is now running!');
        console.log('💡 Use slash commands in your Discord server');
        console.log('📋 Available commands:');
        console.log('   /register - Register an 8BP account');
        console.log('   /list-accounts - List all registered accounts');
        console.log('   /deregister - Remove a registration');
        console.log('   /check-accounts - Check account status');
        console.log('   /help - Show help information');
        
        // Keep the bot running
        process.on('SIGINT', async () => {
          console.log('\n🛑 Shutting down Discord Bot...');
          await this.discordService.logout();
          process.exit(0);
        });
        
        // Keep process alive
        setInterval(() => {}, 1000);
        
      } else {
        console.log('❌ Failed to start Discord Bot');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error starting Discord Bot:', error);
      process.exit(1);
    }
  }
}

// Start the bot if this file is run directly
if (require.main === module) {
  const bot = new DiscordBot();
  bot.start();
}

module.exports = DiscordBot;
