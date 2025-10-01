import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IRegistration extends Document {
  _id: mongoose.Types.ObjectId;
  eightBallPoolId: string;
  username: string;
  registrationIp?: string;
  isBlocked?: boolean;
  blockedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRegistrationModel extends Model<IRegistration> {
  findByEightBallPoolId(eightBallPoolId: string): Promise<IRegistration | null>;
  getAllRegistrations(): Promise<IRegistration[]>;
  getRegistrationCount(): Promise<number>;
}

const registrationSchema = new Schema<IRegistration>({
  eightBallPoolId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },
  username: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 50
  },
  registrationIp: {
    type: String,
    required: false
  },
  isBlocked: {
    type: Boolean,
    default: false,
    index: true
  },
  blockedReason: {
    type: String,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'registrations'
});

// Update the updatedAt field before saving
registrationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to find by 8BP ID
registrationSchema.statics.findByEightBallPoolId = function(eightBallPoolId: string) {
  return this.findOne({ eightBallPoolId });
};

// Static method to get all registrations
registrationSchema.statics.getAllRegistrations = function() {
  return this.find({}).sort({ createdAt: -1 });
};

// Static method to get registration count
registrationSchema.statics.getRegistrationCount = function() {
  return this.countDocuments();
};

export const Registration = mongoose.model<IRegistration, IRegistrationModel>('Registration', registrationSchema);

