import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IClaimRecord extends Document {
  _id: mongoose.Types.ObjectId;
  eightBallPoolId: string;
  websiteUserId: string;
  status: 'success' | 'failed';
  itemsClaimed: string[];
  error?: string;
  claimedAt: Date;
  schedulerRun: Date;
}

export interface IClaimRecordModel extends Model<IClaimRecord> {
  getClaimsByUser(eightBallPoolId: string, limit?: number): Promise<IClaimRecord[]>;
  getRecentClaims(limit?: number): Promise<IClaimRecord[]>;
  getClaimsBySchedulerRun(schedulerRun: Date): Promise<IClaimRecord[]>;
  getClaimStats(days?: number): Promise<any[]>;
  getUserClaimTotals(eightBallPoolId: string, days?: number): Promise<any[]>;
}

const claimRecordSchema = new Schema<IClaimRecord>({
  eightBallPoolId: {
    type: String,
    required: true,
    index: true
  },
  websiteUserId: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    required: true,
    enum: ['success', 'failed'],
    index: true
  },
  itemsClaimed: {
    type: [String],
    default: []
  },
  error: {
    type: String,
    maxlength: 1000
  },
  claimedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  schedulerRun: {
    type: Date,
    required: true,
    index: true
  }
}, {
  collection: 'claim_records',
  timestamps: false
});

// Compound indexes for common queries
claimRecordSchema.index({ eightBallPoolId: 1, claimedAt: -1 });
claimRecordSchema.index({ status: 1, claimedAt: -1 });
claimRecordSchema.index({ schedulerRun: 1, status: 1 });

// Static method to get claims by user
claimRecordSchema.statics.getClaimsByUser = function(eightBallPoolId: string, limit: number = 50) {
  return this.find({ eightBallPoolId }).sort({ claimedAt: -1 }).limit(limit);
};

// Static method to get recent claims
claimRecordSchema.statics.getRecentClaims = function(limit: number = 100) {
  return this.find({}).sort({ claimedAt: -1 }).limit(limit);
};

// Static method to get claims by scheduler run
claimRecordSchema.statics.getClaimsBySchedulerRun = function(schedulerRun: Date) {
  return this.find({ schedulerRun }).sort({ claimedAt: -1 });
};

// Static method to get claim statistics
claimRecordSchema.statics.getClaimStats = function(days: number = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    { $match: { claimedAt: { $gte: startDate } } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalItems: { $sum: { $size: '$itemsClaimed' } }
      }
    }
  ]);
};

// Static method to get user claim totals
claimRecordSchema.statics.getUserClaimTotals = function(eightBallPoolId: string, days: number = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    { $match: { eightBallPoolId, claimedAt: { $gte: startDate } } },
    {
      $group: {
        _id: '$eightBallPoolId',
        totalClaims: { $sum: 1 },
        successfulClaims: { 
          $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
        },
        totalItemsClaimed: { $sum: { $size: '$itemsClaimed' } }
      }
    }
  ]);
};

export const ClaimRecord = mongoose.model<IClaimRecord, IClaimRecordModel>('ClaimRecord', claimRecordSchema);

