import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ILogEntry extends Document {
  _id: mongoose.Types.ObjectId;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  meta?: any;
  timestamp: Date;
  service: string;
  userId?: string;
  action?: string;
  ip?: string;
  userAgent?: string;
}

export interface ILogEntryModel extends Model<ILogEntry> {
  getLogsByLevel(level: string, limit?: number): Promise<ILogEntry[]>;
  getLogsByService(service: string, limit?: number): Promise<ILogEntry[]>;
  getLogsByUser(userId: string, limit?: number): Promise<ILogEntry[]>;
  getLogsWithPagination(page?: number, limit?: number, filters?: any): Promise<ILogEntry[]>;
  getLogStats(days?: number): Promise<any[]>;
}

const logEntrySchema = new Schema<ILogEntry>({
  level: {
    type: String,
    required: true,
    enum: ['error', 'warn', 'info', 'debug'],
    index: true
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  meta: {
    type: Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  service: {
    type: String,
    required: true,
    index: true,
    default: '8bp-rewards'
  },
  userId: {
    type: String,
    index: true,
    sparse: true
  },
  action: {
    type: String,
    index: true,
    sparse: true
  },
  ip: {
    type: String,
    index: true,
    sparse: true
  },
  userAgent: {
    type: String,
    maxlength: 500
  }
}, {
  collection: 'logs',
  timestamps: false
});

// Compound indexes for common queries
logEntrySchema.index({ level: 1, timestamp: -1 });
logEntrySchema.index({ service: 1, timestamp: -1 });
logEntrySchema.index({ userId: 1, timestamp: -1 });
logEntrySchema.index({ action: 1, timestamp: -1 });

// Static method to get logs by level
logEntrySchema.statics.getLogsByLevel = function(level: string, limit: number = 100) {
  return this.find({ level }).sort({ timestamp: -1 }).limit(limit);
};

// Static method to get logs by service
logEntrySchema.statics.getLogsByService = function(service: string, limit: number = 100) {
  return this.find({ service }).sort({ timestamp: -1 }).limit(limit);
};

// Static method to get logs by user
logEntrySchema.statics.getLogsByUser = function(userId: string, limit: number = 100) {
  return this.find({ userId }).sort({ timestamp: -1 }).limit(limit);
};

// Static method to get logs with pagination
logEntrySchema.statics.getLogsWithPagination = function(
  page: number = 1, 
  limit: number = 50, 
  filters: any = {}
) {
  const skip = (page - 1) * limit;
  return this.find(filters).sort({ timestamp: -1 }).skip(skip).limit(limit);
};

// Static method to get log statistics
logEntrySchema.statics.getLogStats = function(days: number = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    { $match: { timestamp: { $gte: startDate } } },
    {
      $group: {
        _id: '$level',
        count: { $sum: 1 },
        latest: { $max: '$timestamp' }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

export const LogEntry = mongoose.model<ILogEntry, ILogEntryModel>('LogEntry', logEntrySchema);

