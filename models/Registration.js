/**
 * JavaScript wrapper for the TypeScript Registration model
 * This allows the Discord bot to use the same model as the backend
 */

const mongoose = require('mongoose');

// Define the schema matching the TypeScript model
const registrationSchema = new mongoose.Schema({
  eightBallPoolId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  username: {
    type: String,
    required: true
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

// Add indexes for faster queries
registrationSchema.index({ createdAt: -1 });
registrationSchema.index({ username: 1 });

// Static methods
registrationSchema.statics.findByEightBallPoolId = function(eightBallPoolId) {
  return this.findOne({ eightBallPoolId });
};

registrationSchema.statics.getAllRegistrations = function() {
  return this.find().sort({ createdAt: -1 });
};

registrationSchema.statics.getRegistrationCount = function() {
  return this.countDocuments();
};

// Update the updatedAt timestamp before saving
registrationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Registration = mongoose.model('Registration', registrationSchema);

module.exports = Registration;
