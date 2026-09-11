const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema({
  name: String,
  phone: String,
  purpose: String,
  source: String,
  photo: String,
  roomNumber: { type: String, default: '' },  // NEW: store room number directly
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  guard: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  entryTime: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
});

module.exports = mongoose.model('Visitor', visitorSchema);
