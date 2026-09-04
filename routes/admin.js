const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Room = require('../models/Room');
const Visitor = require('../models/Visitor');
const { v4: uuidv4 } = require('uuid');

router.use(auth('super_admin'));

// Create Guard
router.post('/guards', async (req, res) => {
  const { name, email, phone, password } = req.body;
  try {
    const guard = await User.create({ 
      name, email, phone, password, 
      role: 'guard', 
      status: 'approved' 
    });
    res.json({ message: 'Guard created successfully', guard });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create Owner directly (approved)
router.post('/owners/create', async (req, res) => {
  const { name, email, phone, password, roomId } = req.body;
  try {
    const owner = await User.create({
      name, email, phone, password,
      role: 'owner',
      status: 'approved',
      room: roomId
    });
    
    const updatedRoom = await Room.findByIdAndUpdate(
      roomId, 
      { owner: owner._id, isAvailable: false },
      { new: true }
    );
    
    console.log('Owner created:', owner.name, 'assigned to room:', updatedRoom.roomNumber);
    
    res.json({ message: 'Owner ' + name + ' assigned to Room ' + updatedRoom.roomNumber, owner, room: updatedRoom });
  } catch (err) {
    console.error('Error creating owner:', err);
    res.status(400).json({ error: err.message });
  }
});

// Get pending owners
router.get('/owners/pending', async (req, res) => {
  const owners = await User.find({ role: 'owner', status: 'pending' }).populate('room');
  res.json(owners);
});

// Approve/Reject owner
router.post('/owners/verify', async (req, res) => {
  const { ownerId, action } = req.body;
  const owner = await User.findById(ownerId).populate('room');
  if (!owner) return res.status(404).json({ error: 'Owner not found' });
  if (action === 'approve') {
    const token = uuidv4();
    owner.activationToken = token;
    owner.status = 'pending_activation';
    await owner.save();
    console.log(`Activation link: http://localhost:5000/owner/activate.html?token=${token}`);
    res.json({ message: 'Owner approved' });
  } else {
    owner.status = 'rejected';
    await owner.save();
    res.json({ message: 'Owner rejected' });
  }
});

// Get all visitors
router.get('/visitors', async (req, res) => {
  try {
    const visitors = await Visitor.find()
      .populate('room', 'roomNumber floor')
      .populate('owner', 'name')
      .populate('guard', 'name')
      .sort({ entryTime: -1 })
      .limit(200);
    res.json(visitors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all rooms with owner info
router.get('/rooms', async (req, res) => {
  try {
    const rooms = await Room.find().populate('owner', 'name email phone');
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a room owner (optional - if needed)
router.post('/owners/remove', async (req, res) => {
  const { roomId } = req.body;
  try {
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    
    if (room.owner) {
      // Remove owner reference
      await User.findByIdAndUpdate(room.owner, { room: null });
    }
    
    room.owner = null;
    room.isAvailable = true;
    await room.save();
    
    res.json({ message: 'Owner removed from room ' + room.roomNumber });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
// Get all owners
router.get('/owners', async (req, res) => {
  try {
    const owners = await User.find({ role: 'owner' }).populate('room', 'roomNumber floor');
    res.json(owners);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
module.exports = router;
