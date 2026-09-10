const router = require('express').Router();
const auth = require('../middleware/auth');
const Visitor = require('../models/Visitor');
const User = require('../models/User');
const { getRoomForOwner } = require('../utils/roomHelper');

router.use(auth('owner'));

// Get current owner profile with room
router.get('/me', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name email phone role');
    if (!user) return res.status(404).json({ error: 'Owner not found' });
    const room = await getRoomForOwner(user._id);
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      room: room ? { roomNumber: room.roomNumber, floor: room.floor } : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pending visitors for this owner
router.get('/pending', async (req, res) => {
  try {
    const visitors = await Visitor.find({ owner: req.user.id, status: 'pending' })
      .populate('room', 'roomNumber floor')
      .sort({ entryTime: -1 });
    res.json(visitors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Visitor history
router.get('/history', async (req, res) => {
  try {
    const visitors = await Visitor.find({ owner: req.user.id, status: { $in: ['approved', 'rejected'] } })
      .populate('room', 'roomNumber floor')
      .sort({ entryTime: -1 })
      .limit(50);
    res.json(visitors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve/Reject visitor
router.post('/respond', async (req, res) => {
  const { visitId, action } = req.body;
  try {
    const visitor = await Visitor.findById(visitId);
    if (!visitor) return res.status(404).json({ error: 'Visitor not found' });
    if (visitor.owner.toString() !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

    visitor.status = action === 'approve' ? 'approved' : 'rejected';
    await visitor.save();

    const io = req.app.get('io');
    io.to(visitId).emit('owner_response', { visitId, status: visitor.status });

    res.json({ message: `Visitor ${action}d`, visitor });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save FCM token
router.post('/fcm-token', async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { fcmToken: req.body.token });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
