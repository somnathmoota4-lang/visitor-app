var token = localStorage.getItem('guardToken');
if (!token) window.location = 'login.html';

var socket = io();
var allRooms = [];
var visitorQueue = [];

// Load rooms (auto retry every 10 seconds if empty)
function loadRooms() {
  fetch('/api/guard/rooms', {
    headers: { 'Authorization': 'Bearer ' + token }
  })
  .then(res => res.json())
  .then(rooms => {
    if (rooms.length > 0) {
      allRooms = rooms;
      setupFloorSelect();
    } else {
      // If no rooms, try again in 10 seconds
      setTimeout(loadRooms, 10000);
    }
  })
  .catch(() => {
    setTimeout(loadRooms, 10000);
  });
}

function setupFloorSelect() {
  var floors = [...new Set(allRooms.map(r => r.floor))].sort((a,b) => a-b);
  var select = document.getElementById('ownerFloor');
  select.innerHTML = '<option value="">🏢 Select Floor</option>';
  floors.forEach(f => select.innerHTML += `<option value="${f}">Floor ${f}</option>`);
}

function loadRoomsByFloor() {
  var floor = document.getElementById('ownerFloor').value;
  var select = document.getElementById('roomId');
  select.innerHTML = '<option value="">🚪 Select Room</option>';
  if (!floor) return;
  var roomsOnFloor = allRooms.filter(r => r.floor == floor && r.owner);
  if (roomsOnFloor.length === 0) {
    select.innerHTML = '<option value="">No rooms with owners on this floor</option>';
    return;
  }
  roomsOnFloor.forEach(r => {
    select.innerHTML += `<option value="${r._id}">Room ${r.roomNumber} - ${r.owner.name}</option>`;
  });
}

// ... (rest of functions: previewPhoto, checkinVisitor, switchTab, updateQueue, loadHistory, socket handlers remain similar to previous guard.js)

// Call loadRooms initially
loadRooms();
// Also attempt every 30 seconds in case room assignments change
setInterval(loadRooms, 30000);
