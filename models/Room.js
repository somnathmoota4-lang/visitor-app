const mongoose = require('mongoose');
const roomSchema = new mongoose.Schema({
  floor: Number,
  roomNumber: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  isAvailable: { type: Boolean, default: true }
});
module.exports = mongoose.model('Room', roomSchema);