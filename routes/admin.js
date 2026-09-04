// Create Owner
router.post('/owners/create', async (req, res) => {
  const { name, email, phone, password, roomId } = req.body;
  try {
    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'This email is already registered. Please use a different email.' });
    }

    // Check if room exists and is free
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.owner) return res.status(400).json({ error: 'This room already has an owner' });

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
    console.error('Create owner error:', err);
    res.status(400).json({ error: err.message });
  }
});
