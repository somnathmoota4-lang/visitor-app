require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static('public/uploads'));
app.use(express.static('public'));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/guard', require('./routes/guard'));
app.use('/api/owner', require('./routes/owner'));

// Socket.io
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  socket.on('joinRoom', (visitId) => {
    socket.join(visitId);
    console.log(`Socket ${socket.id} joined room ${visitId}`);
  });
  socket.on('disconnect', () => console.log('Client disconnected'));
});

app.set('io', io);

// Connect to MongoDB and start server
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    
    // Create default super admin if not exists
    const User = require('./models/User');
    User.findOne({ role: 'super_admin' }).then(adminUser => {
      if (!adminUser) {
        User.create({
          name: 'Super Admin',
          email: 'admin@building.com',
          password: 'Admin@123',
          role: 'super_admin',
          status: 'approved'
        }).then(() => console.log('Default super admin created'));
      }
    });
    
    // Delete existing rooms and create fresh
    const Room = require('./models/Room');
    Room.deleteMany({}).then(() => {
      console.log('Old rooms cleared');
      const rooms = [];
      for (let floor = 1; floor <= 23; floor++) {
        for (let roomNum = 1; roomNum <= 13; roomNum++) {
          rooms.push({
            floor,
            roomNumber: `${floor}${String(roomNum).padStart(2, '0')}`
          });
        }
      }
      Room.insertMany(rooms).then(() => {
        console.log('299 rooms created (23 floors x 13 rooms)');
        
        // Create a test owner and assign to room 101
        const User = require('./models/User');
        const Room = require('./models/Room');
        
        User.findOne({ email: 'test@test.com' }).then(async (existingOwner) => {
          let owner = existingOwner;
          if (!owner) {
            owner = await User.create({
              name: 'Test Owner',
              email: 'test@test.com',
              password: 'test123',
              role: 'owner',
              status: 'approved'
            });
            console.log('Test owner created:', owner._id);
          }
          
          // Assign owner to room 101
          const room101 = await Room.findOne({ roomNumber: '101' });
          if (room101) {
            room101.owner = owner._id;
            room101.isAvailable = false;
            await room101.save();
            console.log('Room 101 assigned to Test Owner');
            
            // Update owner's room field
            owner.room = room101._id;
            await owner.save();
            console.log('Owner room field updated to room 101');
            
            // Verify
            const verify = await Room.findOne({ roomNumber: '101' }).populate('owner');
            console.log('Verification - Room 101 owner:', verify.owner ? verify.owner.name : 'NO OWNER');
          }
        });
      });
    });
    
    server.listen(process.env.PORT || 5000, () => {
      console.log(`Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch(err => console.error('MongoDB connection error:', err));
