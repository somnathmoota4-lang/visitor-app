const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Room = require('../models/Room');
const Visitor = require('../models/Visitor');
const { v4: uuidv4 } = require('uuid');

router.use(auth('super_admin'));

// Create Guard
router.post('/guards', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const guard = await User.create({ name, email, password, role: 'guard', status: 'approved' });
    res.json({ message: 'Guard created', guard });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get pending owners
router.get('/owners/pending', async (req, res) => {
  const owners = await User.find({ role: 'owner', status: 'pending' }).populate('room');
  res.json(owners);
});

// Approve owner (generate activation token)
router.post('/owners/verify', async (req, res) => {
  const { ownerId, action } = req.body;
  const owner = await User.findById(ownerId).populate('room');
  if (!owner) return res.status(404).json({ error: 'Owner not found' });
  if (action === 'approve') {
    const token = uuidv4();
    owner.activationToken = token;
    owner.status = 'pending_activation';
    await owner.save();
    // Simulate sending email
    console.log(`Activation link: http://localhost:5000/owner/activate.html?token=${token}`);
    res.json({ message: 'Owner approved, activation email sent (see console)' });
  } else {
    owner.status = 'rejected';
    await owner.save();
    res.json({ message: 'Owner rejected' });
  }
});

// All visitors (for log)
router.get('/visitors', async (req, res) => {
  const visitors = await Visitor.find().populate('room owner guard').sort({ entryTime: -1 }).limit(200);
  res.json(visitors);
});

// Get all rooms (for management)
router.get('/rooms', async (req, res) => {
  const rooms = await Room.find().populate('owner', 'name');
  res.json(rooms);
});

module.exports = router;