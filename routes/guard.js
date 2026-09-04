const router = require('express').Router();
const auth = require('../middleware/auth');
const Visitor = require('../models/Visitor');
const Room = require('../models/Room');
const upload = require('../middleware/upload');

router.use(auth('guard'));

// ... rest of your code stays the same

router.use(auth('guard'));

// Get rooms that HAVE owners
router.get('/rooms', async (req, res) => {
  try {
    const rooms = await Room.find({ owner: { $ne: null } })
      .populate('owner', 'name phone email')
      .sort({ floor: 1, roomNumber: 1 });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check-in visitor
router.post('/checkin', upload.single('photo'), async (req, res) => {
  const { name, phone, purpose, source, roomId } = req.body;
  const photo = req.file ? '/uploads/' + req.file.filename : null;
  try {
    const room = await Room.findById(roomId).populate('owner');
    if (!room) return res.status(400).json({ error: 'Room not found' });
    if (!room.owner) return res.status(400).json({ error: 'Room has no owner assigned' });

    const visitor = await Visitor.create({
      name, phone, purpose, source, photo,
      room: roomId,
      owner: room.owner._id,
      guard: req.user.id,
      status: 'pending'
    });

    // Socket event (existing)
    const io = req.app.get('io');
    io.to(visitor._id.toString()).emit('pending_visitor', { visitorId: visitor._id, name, room: room.roomNumber });

    // Push notification to owner (if firebase admin initialized) - add later

    res.json({ message: 'Visitor registered, waiting for owner approval', visitId: visitor._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get today's visitors for this guard
router.get('/today', async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0,0,0,0);
    const visitors = await Visitor.find({ guard: req.user.id, entryTime: { $gte: start } })
      .populate('room owner')
      .sort({ entryTime: -1 });
    res.json(visitors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
