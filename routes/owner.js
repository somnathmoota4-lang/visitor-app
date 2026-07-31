const router = require('express').Router();
const auth = require('../middleware/auth');
const Visitor = require('../models/Visitor');
const User = require('../models/User');

router.use(auth('owner'));

// Get pending visitors for this owner
router.get('/pending', async (req, res) => {
  try {
    const visitors = await Visitor.find({ 
      owner: req.user.id, 
      status: 'pending' 
    }).populate('room').sort({ entryTime: -1 });
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
    if (!visitor) {
      return res.status(404).json({ error: 'Visitor not found' });
    }
    if (visitor.owner.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    visitor.status = action === 'approve' ? 'approved' : 'rejected';
    await visitor.save();
    
    // Emit socket event to guard
    const io = req.app.get('io');
    io.to(visitId).emit('owner_response', { 
      visitId, 
      status: visitor.status 
    });
    
    console.log('Visitor', visitor.name, action + 'd by owner');
    
    res.json({ message: 'Visitor ' + action + 'd', visitor });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save FCM token for push notifications
router.post('/fcm-token', async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { fcmToken: req.body.token });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
