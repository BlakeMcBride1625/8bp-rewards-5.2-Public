const mongoose = require('mongoose');
const Registration = require('../models/Registration');

class DatabaseService {
  constructor() {
    this.isConnected = false;
    // Use MONGO_URI to match the .env file (same as backend)
    this.connectionString = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/8bp-rewards';
  }

  async connect() {
    try {
      if (this.isConnected) {
        console.log('📊 Database already connected');
        return true;
      }

      console.log('🔗 Connecting to MongoDB...');
      
      await mongoose.connect(this.connectionString, {
        serverSelectionTimeoutMS: 5000
      });

      this.isConnected = true;
      console.log('✅ Connected to MongoDB successfully');
      
      // Handle connection events
      mongoose.connection.on('error', (error) => {
        console.error('❌ MongoDB connection error:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.log('⚠️ MongoDB disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        console.log('🔄 MongoDB reconnected');
        this.isConnected = true;
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  async disconnect() {
    try {
      if (this.isConnected) {
        await mongoose.connection.close();
        this.isConnected = false;
        console.log('🔌 Disconnected from MongoDB');
      }
    } catch (error) {
      console.error('❌ Error disconnecting from MongoDB:', error.message);
    }
  }

  // Add or update a registration (using eightBallPoolId + username)
  async addOrUpdateUser(eightBallPoolId, username) {
    try {
      await this.ensureConnection();

      // Check for existing registration
      const existing = await Registration.findByEightBallPoolId(eightBallPoolId);

      if (existing) {
        // Update existing registration
        existing.username = username;
        existing.updatedAt = new Date();
        await existing.save();
        console.log(`🔄 Updated registration: ${username} (${eightBallPoolId})`);
        return {
          success: true,
          user: existing,
          isNew: false
        };
      } else {
        // Create new registration
        const registration = new Registration({
          eightBallPoolId,
          username
        });

        await registration.save();
        console.log(`✅ New registration saved: ${username} (${eightBallPoolId})`);

        return {
          success: true,
          user: registration,
          isNew: true
        };
      }

    } catch (error) {
      console.error('❌ Error adding/updating registration:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get all registrations
  async getAllUsers() {
    try {
      await this.ensureConnection();
      const users = await Registration.getAllRegistrations();
      console.log(`📋 Retrieved ${users.length} registrations from database`);
      return users;
    } catch (error) {
      console.error('❌ Error getting all registrations:', error.message);
      return [];
    }
  }

  // Get registration by 8 Ball Pool ID
  async getUserByEightBallPoolId(eightBallPoolId) {
    try {
      await this.ensureConnection();
      return await Registration.findByEightBallPoolId(eightBallPoolId);
    } catch (error) {
      console.error('❌ Error getting registration by 8BP ID:', error.message);
      return null;
    }
  }

  // Remove registration by 8 Ball Pool ID
  async removeUserByEightBallPoolId(eightBallPoolId) {
    try {
      await this.ensureConnection();
      const result = await Registration.findOneAndDelete({ eightBallPoolId });
      if (result) {
        console.log(`🗑️ Removed registration: ${result.username} (${result.eightBallPoolId})`);
        return { success: true, user: result };
      } else {
        return { success: false, error: 'Registration not found' };
      }
    } catch (error) {
      console.error('❌ Error removing registration:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Get registration count
  async getUserCount() {
    try {
      await this.ensureConnection();
      const count = await Registration.getRegistrationCount();
      return count;
    } catch (error) {
      console.error('❌ Error getting registration count:', error.message);
      return 0;
    }
  }

  // Clear all registrations
  async clearAllUsers() {
    try {
      await this.ensureConnection();
      const result = await Registration.deleteMany({});
      console.log(`🗑️ Cleared all registrations (${result.deletedCount} deleted)`);
      return { success: true, count: result.deletedCount };
    } catch (error) {
      console.error('❌ Error clearing registrations:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Backup database to JSON file
  async backupToFile(filename = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`) {
    try {
      await this.ensureConnection();
      const users = await this.getAllUsers();
      
      const backupData = {
        timestamp: new Date().toISOString(),
        totalUsers: users.length,
        users: users.map(user => ({
          eightBallPoolId: user.eightBallPoolId,
          username: user.username,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }))
      };

      const fs = require('fs');
      fs.writeFileSync(filename, JSON.stringify(backupData, null, 2));
      console.log(`💾 Database backed up to ${filename}`);
      return { success: true, filename, userCount: users.length };
    } catch (error) {
      console.error('❌ Error creating backup:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Ensure database connection
  async ensureConnection() {
    if (!this.isConnected) {
      await this.connect();
    }
  }

  // Health check
  async healthCheck() {
    try {
      await this.ensureConnection();
      const count = await this.getUserCount();
      return {
        connected: this.isConnected,
        userCount: count,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = DatabaseService;