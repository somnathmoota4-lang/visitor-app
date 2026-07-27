const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, sparse: true },
  phone: String,
  role: { type: String, enum: ['super_admin', 'guard', 'owner'], required: true },
  password: String,
  documents: [String],
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'pending_activation'], default: 'pending' },
  activationToken: String,
  fcmToken: String,
  guardId: String
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

module.exports = mongoose.model('User', userSchema);