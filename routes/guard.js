const router = require('express').Router();
const auth = require('../middleware/auth');
const Visitor = require('../models/Visitor');
const User = require('../models/User');
const upload = require('../middleware/upload');
const admin = require('firebase-admin');

router.use(auth('guard'));

// ---------- GET ROOMS WITH OWNERS ----------
router.get('/rooms', async (req, res) => {
  try {
    const owners = await User.find({
      role: 'owner',
      status: 'approved',
      roomNumber: { $ne: '' }
    }).select('name roomNumber phone');

    const roomsList = owners.map(o => ({
      roomNumber: o.roomNumber,
      floor: parseInt(o.roomNumber.charAt(0)) || 0,
      owner: { name: o.name, phone: o.phone || '' }
    }));

    res.json(roomsList);
  } catch (err) {
    console.error('Error loading rooms for guard:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- CHECK-IN VISITOR ----------
router.post('/checkin', upload.single('photo'), async (req, res) => {
  const { name, phone, purpose, source, roomId } = req.body;
  const photo = req.file ? '/uploads/' + req.file.filename : null;

  try {
    const roomNumber = String(roomId || '').trim();
    if (!roomNumber) {
      return res.status(400).json({ error: 'Room number is required' });
    }

    const owner = await User.findOne({
      role: 'owner',
      status: 'approved',
      roomNumber: roomNumber
    });

    if (!owner) {
      return res.status(400).json({ error: 'No owner found for Room ' + roomNumber });
    }

    const visitor = await Visitor.create({
      name,
      phone,
      purpose,
      source,
      photo,
      roomNumber: roomNumber,
      owner: owner._id,
      guard: req.user.id,
      status: 'pending'
    });

    // Real-time notification via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(visitor._id.toString()).emit('pending_visitor', {
        visitorId: visitor._id,
        name,
        room: roomNumber
      });
    }

    // ============================================================
    // PUSH NOTIFICATION TO OWNER
    // ============================================================
    try {
      if (owner.fcmToken) {
        await admin.messaging().send({
          token: owner.fcmToken,
          notification: {
            title: '🚨 New Visitor',
            body: `${name} is here to meet you (${purpose})`
          },
          data: {
            visitId: visitor._id.toString(),
            type: 'visitor_request'
          }
        });
        console.log('✅ Push notification sent to owner:', owner.name);
      } else {
        console.log('⚠️ Owner has no FCM token yet (has not allowed notifications)');
      }
    } catch (pushErr) {
      console.log('⚠️ Push notification failed:', pushErr.message);
    }
    // ============================================================

    console.log(`✅ Visitor ${name} checked in → Room ${roomNumber} (Owner: ${owner.name})`);

    res.json({
      message: 'Visitor registered, waiting for owner approval',
      visitId: visitor._id
    });
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---------- TODAY'S VISITORS ----------
router.get('/today', async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const visitors = await Visitor.find({
      guard: req.user.id,
      entryTime: { $gte: start }
    })
      .populate('owner', 'name roomNumber')
      .sort({ entryTime: -1 });

    res.json(visitors);
  } catch (err) {
    console.error('Error fetching today visitors:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
