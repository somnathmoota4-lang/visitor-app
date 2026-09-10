const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Room = require('../models/Room');
const Visitor = require('../models/Visitor');
const {
  getRoomForOwner,
  getOwnerWithRoom,
  getAllOwnersWithRooms,
  assignRoomToOwner,
  removeOwnerFromRoom
} = require('../utils/roomHelper');

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
  const { name, email, phone, password, roomId } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'This email is already registered.' });

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.owner) return res.status(400).json({ error: 'Room already has an owner' });

    const owner = await User.create({
      name, email, phone, password,
      role: 'owner',
      status: 'approved'
      // NOTE: we do NOT store room on user anymore
    });

    room.owner = owner._id;
    room.isAvailable = false;
    await room.save();

    res.json({ message: `Owner ${owner.name} assigned to Room ${room.roomNumber}`, owner: { ...owner.toObject(), room } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- GET ALL ACTIVE OWNERS WITH ROOMS ----------
router.get('/owners', async (req, res) => {
  try {
    const owners = await getAllOwnersWithRooms();
    res.json(owners);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- GET SINGLE OWNER WITH ROOM ----------
router.get('/owners/:id', async (req, res) => {
  try {
    const owner = await getOwnerWithRoom(req.params.id);
    if (!owner) return res.status(404).json({ error: 'Owner not found' });
    res.json(owner);
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
    res.json({ message: 'Owner updated', owner });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- CHANGE / ASSIGN ROOM ----------
router.put('/owners/:id/room', async (req, res) => {
  const { roomNumber } = req.body;
  try {
    const room = await assignRoomToOwner(req.params.id, roomNumber.trim());
    res.json({ message: `Owner assigned to Room ${room.roomNumber}` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- REMOVE OWNER (FREE ROOM + INACTIVE) ----------
router.delete('/owners/:id', async (req, res) => {
  try {
    const owner = await User.findById(req.params.id);
    if (!owner || owner.role !== 'owner') return res.status(404).json({ error: 'Owner not found' });

    await removeOwnerFromRoom(owner._id);

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
    const rooms = await Room.find().populate('owner', 'name email phone');
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- REPAIR (Optional - keeps backward compatibility) ----------
router.get('/fix-owners', async (req, res) => {
  try {
    // For each room with owner, ensure the owner user still exists and is active.
    const rooms = await Room.find({ owner: { $ne: null } });
    let fixed = 0;
    for (const room of rooms) {
      const owner = await User.findById(room.owner);
      if (!owner || owner.role !== 'owner' || owner.status !== 'approved') {
        // Stale link, clear it
        room.owner = null;
        room.isAvailable = true;
        await room.save();
        fixed++;
      }
    }
    res.json({ message: `Repaired ${fixed} stale room links` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
