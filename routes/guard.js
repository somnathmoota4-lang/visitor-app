const router = require('express').Router();
const auth = require('../middleware/auth');
const Visitor = require('../models/Visitor');
const Room = require('../models/Room');
const upload = require('../middleware/upload');

router.use(auth('guard'));

// Get all rooms with owner info
router.get('/rooms', async (req, res) => {
  try {
    const rooms = await Room.find().populate('owner', 'name phone email');
    console.log('Rooms loaded for guard:', rooms.length);
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check-in visitor
router.post('/checkin', upload.single('photo'), async (req, res) => {
  const { name, phone, purpose, roomId } = req.body;
  const photo = req.file ? '/uploads/' + req.file.filename : null;
  
  try {
    const room = await Room.findById(roomId).populate('owner');
    
    if (!room) {
      return res.status(400).json({ error: 'Room not found' });
    }
    
    if (!room.owner) {
      return res.status(400).json({ error: 'Room has no owner assigned' });
    }
    
    const visitor = await Visitor.create({
      name, phone, purpose, photo,
      room: roomId,
      owner: room.owner._id,
      guard: req.user.id,
      status: 'pending'
    });
    
    console.log('Visitor checked in:', visitor.name, 'for room:', room.roomNumber);
    
    // Emit socket event for real-time notification
    const io = req.app.get('io');
    io.to(visitor._id.toString()).emit('pending_visitor', { 
      visitorId: visitor._id, 
      name: visitor.name,
      room: room.roomNumber 
    });
    
    res.json({ 
      message: 'Visitor registered, waiting for owner approval', 
      visitId: visitor._id,
      visitor: visitor 
    });
    
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get today's visitors for this guard
router.get('/today', async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const visitors = await Visitor.find({ 
      guard: req.user.id, 
      entryTime: { $gte: start } 
    }).populate('room owner');
    res.json(visitors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
