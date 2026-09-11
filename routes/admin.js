const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Room = require('../models/Room');
const Visitor = require('../models/Visitor');

router.use(auth('super_admin'));

// ---------- CREATE GUARD ----------
router.post('/guards', async (req, res) => {
  const { name, email, phone, password } = req.body;
  try {
    const guard = await User.create({ name, email, phone, password, role: 'guard', status: 'approved' });
    res.json({ message: 'Guard created successfully', guard });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- CREATE OWNER ----------
router.post('/owners/create', async (req, res) => {
  const { name, email, phone, password, roomNumber } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'This email is already registered.' });

    if (!roomNumber) return res.status(400).json({ error: 'Room number is required' });

    const roomTaken = await User.findOne({ role: 'owner', status: 'approved', roomNumber: roomNumber });
    if (roomTaken) return res.status(400).json({ error: `Room ${roomNumber} already has an owner (${roomTaken.name})` });

    const owner = await User.create({
      name, email, phone, password,
      role: 'owner',
      status: 'approved',
      roomNumber: roomNumber
    });

    // Also mark the Room document as occupied (convenience)
    const room = await Room.findOne({ roomNumber: roomNumber });
    if (room) {
      room.owner = owner._id;
      room.isAvailable = false;
      await room.save();
    }

    res.json({ message: `Owner ${owner.name} assigned to Room ${roomNumber}` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- GET ALL ACTIVE OWNERS ----------
router.get('/owners', async (req, res) => {
  try {
    const owners = await User.find({ role: 'owner', status: 'approved' })
      .select('name email phone roomNumber status');
    res.json(owners);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- EDIT OWNER DETAILS ----------
router.put('/owners/:id', async (req, res) => {
  const { name, phone, email } = req.body;
  try {
    const owner = await User.findById(req.params.id);
    if (!owner || owner.role !== 'owner') return res.status(404).json({ error: 'Owner not found' });

    if (email && email !== owner.email) {
      const existing = await User.findOne({ email });
      if (existing) return res.status(400).json({ error: 'Email already in use' });
      owner.email = email;
    }
    if (name) owner.name = name;
    if (phone) owner.phone = phone;
    await owner.save();
    res.json({ message: 'Owner updated' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- CHANGE / ASSIGN ROOM NUMBER ----------
router.put('/owners/:id/room', async (req, res) => {
  const { roomNumber } = req.body;
  try {
    if (!roomNumber) return res.status(400).json({ error: 'Room number is required' });

    const owner = await User.findById(req.params.id);
    if (!owner || owner.role !== 'owner') return res.status(404).json({ error: 'Owner not found' });

    const roomTaken = await User.findOne({
      role: 'owner', status: 'approved',
      roomNumber: roomNumber,
      _id: { $ne: owner._id }
    });
    if (roomTaken) return res.status(400).json({ error: `Room ${roomNumber} already has an owner (${roomTaken.name})` });

    // Free old room in Room collection
    if (owner.roomNumber) {
      const oldRoom = await Room.findOne({ roomNumber: owner.roomNumber });
      if (oldRoom) {
        oldRoom.owner = null;
        oldRoom.isAvailable = true;
        await oldRoom.save();
      }
    }

    // Update user
    owner.roomNumber = roomNumber.trim();
    await owner.save();

    // Mark new room occupied
    const newRoom = await Room.findOne({ roomNumber: roomNumber.trim() });
    if (newRoom) {
      newRoom.owner = owner._id;
      newRoom.isAvailable = false;
      await newRoom.save();
    }

    res.json({ message: `Owner ${owner.name} assigned to Room ${roomNumber}` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- REMOVE OWNER ----------
router.delete('/owners/:id', async (req, res) => {
  try {
    const owner = await User.findById(req.params.id);
    if (!owner || owner.role !== 'owner') return res.status(404).json({ error: 'Owner not found' });

    if (owner.roomNumber) {
      const room = await Room.findOne({ roomNumber: owner.roomNumber });
      if (room) {
        room.owner = null;
        room.isAvailable = true;
        await room.save();
      }
    }

    owner.roomNumber = '';
    owner.status = 'inactive';
    await owner.save();

    res.json({ message: 'Owner removed from room' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- GET ALL ROOMS ----------
router.get('/rooms', async (req, res) => {
  try {
    const rooms = await Room.find().sort({ floor: 1, roomNumber: 1 });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- VISITOR LOG ----------
router.get('/visitors-full', async (req, res) => {
  try {
    const visitors = await Visitor.find()
      .populate('guard', 'name email phone')
      .populate('owner', 'name email phone roomNumber')
      .populate('room', 'roomNumber floor')
      .sort({ entryTime: -1 })
      .limit(200);
    res.json(visitors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- DEBUG ----------
router.get('/debug-data', async (req, res) => {
  try {
    const owners = await User.find({ role: 'owner' }).select('name email phone status roomNumber');
    res.json({ totalOwners: owners.length, owners });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- FIX: Sync Room collection with User.roomNumber ----------
router.post('/fix-broken-links', async (req, res) => {
  try {
    const results = { synced: 0, orphans: [], details: [] };

    const rooms = await Room.find();
    for (const room of rooms) {
      const owner = await User.findOne({ role: 'owner', status: 'approved', roomNumber: room.roomNumber });
      if (owner) {
        room.owner = owner._id;
        room.isAvailable = false;
        await room.save();
        results.synced++;
        results.details.push(`✅ Room ${room.roomNumber} → ${owner.name}`);
      } else if (room.owner) {
        room.owner = null;
        room.isAvailable = true;
        await room.save();
        results.details.push(`🗑️ Cleared Room ${room.roomNumber} (no active owner)`);
      }
    }

    const owners = await User.find({ role: 'owner', status: 'approved' });
    for (const owner of owners) {
      if (!owner.roomNumber) {
        results.orphans.push({ id: owner._id, name: owner.name, email: owner.email });
        results.details.push(`⚠️ ${owner.name} has no room number`);
      }
    }

    res.json({ message: `Synced ${results.synced} rooms, ${results.orphans.length} orphans`, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
