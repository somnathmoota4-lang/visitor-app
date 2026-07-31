require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Room = require('./models/Room');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Create a test owner
    const owner = await User.create({
      name: 'Test Owner',
      email: 'test@test.com',
      password: 'test123',
      role: 'owner',
      status: 'approved'
    });
    console.log('Owner created:', owner._id);
    
    // Find an empty room
    const room = await Room.findOne({ owner: null });
    console.log('Empty room found:', room.roomNumber, 'ID:', room._id);
    
    // Assign owner to room
    room.owner = owner._id;
    room.isAvailable = false;
    await room.save();
    console.log('Room updated:', room.roomNumber, 'now has owner');
    
    // Verify
    const verify = await Room.findById(room._id).populate('owner');
    console.log('Verification - Room', verify.roomNumber, 'Owner:', verify.owner ? verify.owner.name : 'NO OWNER');
    
    mongoose.disconnect();
    console.log('Done!');
  })
  .catch(err => console.error('Error:', err));
