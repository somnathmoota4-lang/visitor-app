const router = require('express').Router();
const auth = require('../middleware/auth');
const Visitor = require('../models/Visitor');
const Room = require('../models/Room');
const upload = require('../middleware/upload');

router.use(auth('guard'));

router.get('/rooms', async (req, res) => {
  const rooms = await Room.find().populate('owner', 'name phone');
  res.json(rooms);
});

router.post('/checkin', upload.single('photo'), async (req, res) => {
  const { name, phone, purpose, roomId } = req.body;
  const photo = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    const room = await Room.findById(roomId).populate('owner');
    if (!room || !room.owner) return res.status(400).json({ error: 'Room has no owner assigned' });
    const visitor = await Visitor.create({
      name, phone, purpose, photo,
      room: roomId,
      owner: room.owner._id,
      guard: req.user.id,
      status: 'pending'
    });
    // Send push notification (skipped if FCM not set)
    const io = req.app.get('io');
    // We'll emit a test event for now; real push handled later.
    io.to(visitor._id.toString()).emit('pending_visitor', { visitorId: visitor._id, name });
    res.json({ message: 'Visitor registered, waiting for owner approval', visitId: visitor._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get today's visitors for the guard
router.get('/today', async (req, res) => {
  const start = new Date();
  start.setHours(0,0,0,0);
  const visitors = await Visitor.find({ guard: req.user.id, entryTime: { $gte: start } }).populate('room owner');
  res.json(visitors);
});

module.exports = router;