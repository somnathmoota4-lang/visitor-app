const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Room = require('../models/Room');
const Visitor = require('../models/Visitor');

router.use(auth('super_admin'));

// Create Guard
router.post('/guards', async (req, res) => {
  const { name, email, phone, password } = req.body;
  try {
    const guard = await User.create({ name, email, phone, password, role: 'guard', status: 'approved' });
    res.json({ message: 'Guard created successfully', guard });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create Owner
router.post('/owners/create', async (req, res) => {
  const { name, email, phone, password, roomId } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'This email is already registered.' });
    }
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.owner) return res.status(400).json({ error: 'Room already has an owner' });

    const owner = await User.create({
      name, email, phone, password,
      role: 'owner',
      status: 'approved',
      room: roomId
    });
    room.owner = owner._id;
    room.isAvailable = false;
    await room.save();

    console.log(`Owner ${owner.name} assigned to Room ${room.roomNumber}`);
    res.json({ message: 'Owner created', owner, room });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all active owners
router.get('/owners', async (req, res) => {
  try {
    const owners = await User.find({ role: 'owner', status: 'approved' }).populate('room', 'roomNumber floor');
    res.json(owners);
  } catch (err) {
    console.error('Get owners error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Edit owner (name, phone, email)
router.put('/owners/:id', async (req, res) => {
  const { name, phone, email } = req.body;
  try {
    const owner = await User.findById(req.params.id);
    if (!owner || owner.role !== 'owner') return res.status(404).json({ error: 'Owner not found' });

    // Check email uniqueness if changed
    if (email && email !== owner.email) {
      const existing = await User.findOne({ email });
      if (existing) return res.status(400).json({ error: 'Email already in use' });
      owner.email = email;
    }
    if (name) owner.name = name;
    if (phone) owner.phone = phone;

    await owner.save();
    res.json({ message: 'Owner updated', owner });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Remove owner (unassign room)
router.delete('/owners/:id', async (req, res) => {
  try {
    const owner = await User.findById(req.params.id);
    if (!owner || owner.role !== 'owner') return res.status(404).json({ error: 'Owner not found' });

    // Free the room
    if (owner.room) {
      const room = await Room.findById(owner.room);
      if (room) {
        room.owner = null;
        room.isAvailable = true;
        await room.save();
      }
    }
    owner.room = null;
    owner.status = 'inactive'; // or delete, but we keep for history
    await owner.save();

    res.json({ message: 'Owner removed from room' });
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

// Get all visitors
router.get('/visitors', async (req, res) => {
  try {
    const visitors = await Visitor.find().populate('room owner guard').sort({ entryTime: -1 }).limit(100);
    res.json(visitors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
