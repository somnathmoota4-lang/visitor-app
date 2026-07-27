const router = require('express').Router();
const auth = require('../middleware/auth');
const Visitor = require('../models/Visitor');
const User = require('../models/User');

router.use(auth('owner'));

router.get('/pending', async (req, res) => {
  const visitors = await Visitor.find({ owner: req.user.id, status: 'pending' }).populate('room').sort({ entryTime: -1 });
  res.json(visitors);
});

router.post('/respond', async (req, res) => {
  const { visitId, action } = req.body;
  const visitor = await Visitor.findById(visitId);
  if (!visitor || visitor.owner.toString() !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
  visitor.status = action === 'approve' ? 'approved' : 'rejected';
  await visitor.save();
  const io = req.app.get('io');
  io.to(visitId).emit('owner_response', { visitId, status: visitor.status });
  res.json({ message: `Visitor ${action}ed` });
});

router.post('/fcm-token', async (req, res) => {
  await User.findByIdAndUpdate(req.user.id, { fcmToken: req.body.token });
  res.json({ success: true });
});

module.exports = router;