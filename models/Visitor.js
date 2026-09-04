const mongoose = require('mongoose');
const visitorSchema = new mongoose.Schema({
  name: String,
  phone: String,
  purpose: String,
  source: String,   // added
  photo: String,
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  guard: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  entryTime: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
});
module.exports = mongoose.model('Visitor', visitorSchema);
