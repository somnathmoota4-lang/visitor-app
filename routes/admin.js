const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Room = require('../models/Room');
const Visitor = require('../models/Visitor');

router.use(auth('super_admin'));

// Create Guard
router.post('/guards', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const guard = await User.create({ name, email, password, role: 'guard', status: 'approved' });
    res.json({ message: 'Guard created successfully', guard });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create Owner
router.post('/owners/create', async (req, res) => {
  const { name, email, phone, password, roomId } = req.body;
  try {
    // Check if room exists and is free
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.owner) return res.status(400).json({ error: 'Room already has an owner' });

    // Create owner
    const owner = await User.create({
      name, email, phone, password,
      role: 'owner',
      status: 'approved',
      room: roomId
    });

    // Assign owner to room
    room.owner = owner._id;
    room.isAvailable = false;
    await room.save();

    console.log(`Owner ${owner.name} assigned to Room ${room.roomNumber}`);
    res.json({ message: 'Owner created', owner, room });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all rooms
router.get('/rooms', async (req, res) => {
  try {
    const rooms = await Room.find().populate('owner', 'name email phone');
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all visitors (optional, for future)
router.get('/visitors', async (req, res) => {
  try {
    const visitors = await Visitor.find().populate('room owner guard').sort({ entryTime: -1 }).limit(100);
    res.json(visitors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
