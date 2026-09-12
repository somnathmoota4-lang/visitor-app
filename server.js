require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

// ============================================================
// FIREBASE ADMIN SDK INITIALIZATION
// ============================================================
const admin = require('firebase-admin');
try {
  const secretPath = '/etc/secrets/firebase-admin-key.json';
  const localPath = path.join(__dirname, 'firebase-admin-key.json');
  const keyPath = fs.existsSync(secretPath) ? secretPath : localPath;

  const serviceAccount = require(keyPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('✅ Firebase Admin initialized from', keyPath);
} catch (err) {
  console.log('⚠️ Firebase Admin init skipped:', err.message);
}
// ============================================================

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
  .then(async () => {
    console.log('MongoDB connected');

    // Create default super admin if not exists
    const User = require('./models/User');
    const adminUser = await User.findOne({ role: 'super_admin' });
    if (!adminUser) {
      await User.create({
        name: 'Super Admin',
        email: 'admin@building.com',
        password: 'Admin@123',
        role: 'super_admin',
        status: 'approved'
      });
      console.log('Default super admin created: admin@building.com / Admin@123');
    }

    // Create rooms ONLY IF they don't exist
    const Room = require('./models/Room');
    const roomCount = await Room.countDocuments();
    if (roomCount === 0) {
      const rooms = [];
      for (let floor = 1; floor <= 23; floor++) {
        for (let roomNum = 1; roomNum <= 13; roomNum++) {
          rooms.push({
            floor,
            roomNumber: `${floor}${String(roomNum).padStart(2, '0')}`
          });
        }
      }
      await Room.insertMany(rooms);
      console.log('299 rooms created (23 floors x 13 rooms)');
    } else {
      console.log(`Rooms already exist (${roomCount}) — skipping creation`);
    }

    server.listen(process.env.PORT || 5000, () => {
      console.log(`Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch(err => console.error('MongoDB connection error:', err));
