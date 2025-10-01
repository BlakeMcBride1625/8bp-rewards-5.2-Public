import mongoose from 'mongoose';
import { logger } from './LoggerService';

export class DatabaseService {
  private isConnected: boolean = false;
  private connectionString: string;

  constructor() {
    this.connectionString = process.env.MONGO_URI || 'mongodb://localhost:27017/8bp-rewards';
  }

  async connect(): Promise<boolean> {
    try {
      if (this.isConnected) {
        logger.info('📊 Database already connected');
        return true;
      }

      logger.info('🔗 Connecting to MongoDB...');
      
      await mongoose.connect(this.connectionString, {
        serverSelectionTimeoutMS: 5000
      });

      this.isConnected = true;
      logger.info('✅ Connected to MongoDB successfully');
      
      // Handle connection events
      mongoose.connection.on('error', (error) => {
      logger.error('❌ MongoDB connection error:', { error: error instanceof Error ? error.message : 'Unknown error' });
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        logger.info('⚠️ MongoDB disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('🔄 MongoDB reconnected');
        this.isConnected = true;
      });

      return true;
    } catch (error) {
      logger.error('❌ Failed to connect to MongoDB:', { error: error instanceof Error ? error.message : 'Unknown error' });
      this.isConnected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await mongoose.disconnect();
        this.isConnected = false;
        logger.info('🔒 Disconnected from MongoDB');
      }
    } catch (error) {
      logger.error('❌ Error disconnecting from MongoDB:', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  async healthCheck(): Promise<{ connected: boolean; userCount: number; timestamp: string; error?: string }> {
    try {
      await this.ensureConnection();
      const count = await mongoose.connection.db?.collection('registrations').countDocuments() || 0;
      return {
        connected: this.isConnected,
        userCount: count,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        connected: false,
        userCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  private async ensureConnection(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }
  }
}
