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

// Firebase Admin setup (we'll initialize after we get the key)
const admin = require('firebase-admin');
// We'll initialize Firebase only when the key file exists
if (process.env.FIREBASE_PROJECT_ID) {
  // For now, we'll skip actual Firebase init; push notifications will be added later.
  // admin.initializeApp({...});
}

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
        }).then(() => console.log('Default super admin created: admin@building.com / Admin@123'));
      }
    });
    // Initialize rooms
    const Room = require('./models/Room');
const rooms = [];
for (let floor = 1; floor <= 23; floor++) {
  for (let roomNum = 1; roomNum <= 13; roomNum++) {
    rooms.push({
      floor,
      roomNumber: `${floor}${String(roomNum).padStart(2, '0')}`
    });
  }
}
Room.insertMany(rooms).then(() => console.log('Rooms initialized')).catch(err => console.log('Rooms may already exist:', err.message));
    server.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));
  })
  .catch(err => console.error('MongoDB connection error:', err));
