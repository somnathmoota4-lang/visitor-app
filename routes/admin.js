const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Room = require('../models/Room');
const Visitor = require('../models/Visitor');
const {
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
    });

    room.owner = owner._id;
    room.isAvailable = false;
    await room.save();

    res.json({ message: `Owner ${owner.name} assigned to Room ${room.roomNumber}` });
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

// ---------- GET SINGLE OWNER ----------
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
    res.json({ message: 'Owner updated' });
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

// ---------- REMOVE OWNER ----------
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

// ---------- GET VISITORS WITH GUARD + OWNER + ROOM ----------
router.get('/visitors-full', async (req, res) => {
  try {
    const visitors = await Visitor.find()
      .populate('guard', 'name email phone')
      .populate('owner', 'name email phone')
      .populate('room', 'roomNumber floor')
      .sort({ entryTime: -1 })
      .limit(200);
    res.json(visitors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- DEBUG: See raw owner and room data ----------
router.get('/debug-data', async (req, res) => {
  try {
    const owners = await User.find({ role: 'owner' }).select('name email phone status');
    const roomsWithOwners = await Room.find({ owner: { $ne: null } }).populate('owner', 'name email');

    const ownerRoomMap = await Promise.all(owners.map(async (owner) => {
      const room = await Room.findOne({ owner: owner._id });
      return {
        ownerId: owner._id,
        name: owner.name,
        email: owner.email,
        status: owner.status,
        hasRoomInRoomCollection: !!room,
        roomNumber: room ? room.roomNumber : null
      };
    }));

    res.json({
      totalOwners: owners.length,
      totalRoomsWithOwner: roomsWithOwners.length,
      owners: ownerRoomMap
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- FIX: Repair broken owner-room links ----------
router.post('/fix-broken-links', async (req, res) => {
  try {
    const results = { cleared: 0, matched: 0, orphans: [], details: [] };

    // Step 1: Clear stale room.owner references (owner missing or inactive)
    const roomsWithOwner = await Room.find({ owner: { $ne: null } });
    for (const room of roomsWithOwner) {
      const owner = await User.findById(room.owner);
      if (!owner) {
        results.details.push(`🗑️ Cleared Room ${room.roomNumber} (owner no longer exists)`);
        room.owner = null;
        room.isAvailable = true;
        await room.save();
        results.cleared++;
      } else if (owner.role !== 'owner' || owner.status !== 'approved') {
        results.details.push(`🗑️ Cleared Room ${room.roomNumber} (owner inactive or wrong role)`);
        room.owner = null;
        room.isAvailable = true;
        await room.save();
        results.cleared++;
      }
    }

    // Step 2: For each active owner, verify they have a room
    const owners = await User.find({ role: 'owner', status: 'approved' });
    for (const owner of owners) {
      const room = await Room.findOne({ owner: owner._id });
      if (room) {
        results.details.push(`✅ ${owner.name} → Room ${room.roomNumber}`);
        results.matched++;
      } else {
        results.details.push(`⚠️ ${owner.name} (${owner.email}) has NO room — use 🔁 Room button to assign`);
        results.orphans.push({ id: owner._id, name: owner.name, email: owner.email });
      }
    }

    res.json({
      message: `Cleared ${results.cleared} stale links, matched ${results.matched} owners with rooms, ${results.orphans.length} orphan owners`,
      results
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
