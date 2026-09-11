const router = require('express').Router();
const auth = require('../middleware/auth');
const Visitor = require('../models/Visitor');
const User = require('../models/User');

router.use(auth('owner'));

// ---------- OWNER PROFILE ----------
router.get('/me', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name email phone role roomNumber');
    if (!user) return res.status(404).json({ error: 'Owner not found' });
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      roomNumber: user.roomNumber || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- PENDING VISITORS ----------
router.get('/pending', async (req, res) => {
  try {
    const visitors = await Visitor.find({ owner: req.user.id, status: 'pending' })
      .sort({ entryTime: -1 });
    res.json(visitors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- HISTORY ----------
router.get('/history', async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = { owner: req.user.id, status: { $in: ['approved', 'rejected'] } };
    if (from || to) {
      filter.entryTime = {};
      if (from) filter.entryTime.$gte = new Date(from);
      if (to) { const end = new Date(to); end.setHours(23, 59, 59, 999); filter.entryTime.$lte = end; }
    }
    const visitors = await Visitor.find(filter)
      .sort({ entryTime: -1 })
      .limit(200);
    res.json(visitors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- APPROVE / REJECT ----------
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

// ---------- FCM TOKEN ----------
router.post('/fcm-token', async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { fcmToken: req.body.token });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
