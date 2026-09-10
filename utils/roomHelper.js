const Room = require('../models/Room');

/**
 * Get the room assigned to a given owner.
 * Always uses Room.owner as the single source of truth.
 */
async function getRoomForOwner(ownerId) {
  if (!ownerId) return null;
  return await Room.findOne({ owner: ownerId }).select('roomNumber floor');
}

/**
 * Get owner details along with their room.
 */
async function getOwnerWithRoom(ownerId) {
  const User = require('../models/User');
  const owner = await User.findById(ownerId).select('name email phone role status');
  if (!owner) return null;
  const room = await getRoomForOwner(ownerId);
  return {
    _id: owner._id,
    name: owner.name,
    email: owner.email,
    phone: owner.phone,
    role: owner.role,
    status: owner.status,
    room: room ? { roomNumber: room.roomNumber, floor: room.floor } : null
  };
}

/**
 * Get list of all active owners with their rooms.
 */
async function getAllOwnersWithRooms() {
  const User = require('../models/User');
  const owners = await User.find({ role: 'owner', status: 'approved' }).select('name email phone status');
  const result = [];
  for (const owner of owners) {
    const room = await getRoomForOwner(owner._id);
    result.push({
      _id: owner._id,
      name: owner.name,
      email: owner.email,
      phone: owner.phone,
      status: owner.status,
      room: room ? { roomNumber: room.roomNumber, floor: room.floor } : null
    });
  }
  return result;
}

/**
 * Assign a room to an owner. Frees any previous room.
 */
async function assignRoomToOwner(ownerId, roomNumber) {
  const User = require('../models/User');
  const owner = await User.findById(ownerId);
  if (!owner || owner.role !== 'owner') throw new Error('Owner not found');

  const newRoom = await Room.findOne({ roomNumber: roomNumber });
  if (!newRoom) throw new Error('Room not found');
  if (newRoom.owner && newRoom.owner.toString() !== ownerId.toString()) {
    throw new Error('Room already occupied by another owner');
  }

  // Free any previous room owned by this owner
  await Room.updateMany({ owner: ownerId }, { $set: { owner: null, isAvailable: true } });

  // Assign new room
  newRoom.owner = ownerId;
  newRoom.isAvailable = false;
  await newRoom.save();

  return newRoom;
}

/**
 * Remove an owner from their room (free the room).
 */
async function removeOwnerFromRoom(ownerId) {
  await Room.updateMany({ owner: ownerId }, { $set: { owner: null, isAvailable: true } });
}

module.exports = {
  getRoomForOwner,
  getOwnerWithRoom,
  getAllOwnersWithRooms,
  assignRoomToOwner,
  removeOwnerFromRoom
};
