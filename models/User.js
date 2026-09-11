const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, sparse: true },
  phone: String,
  role: { type: String, enum: ['super_admin', 'guard', 'owner'], required: true },
  password: String,
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'pending_activation', 'inactive'],
    default: 'pending'
  },
  roomNumber: { type: String, default: '' },
  activationToken: String,
  fcmToken: String,
  resetOTP: String,
  resetOTPExpires: Date
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

module.exports = mongoose.model('User', userSchema);
