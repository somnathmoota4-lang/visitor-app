const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  category: { type: String, default: 'other' },
  description: { type: String, required: true },
  status: { type: String, enum: ['pending', 'in_progress', 'resolved'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Complaint', complaintSchema);
