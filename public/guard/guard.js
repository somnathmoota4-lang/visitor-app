const token = localStorage.getItem('guardToken');
if (!token) window.location = 'login.html';

const socket = io();
let currentVisitId = null;

// Load rooms
fetch('/api/guard/rooms', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(res => res.json()).then(rooms => {
  const select = document.getElementById('roomId');
  rooms.forEach(room => {
    const option = document.createElement('option');
    option.value = room._id;
    option.textContent = `Floor ${room.floor} - Room ${room.roomNumber} (${room.owner ? room.owner.name : 'No owner'})`;
    if (!room.owner) option.disabled = true;
    select.appendChild(option);
  });
});

document.getElementById('checkinForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const res = await fetch('/api/guard/checkin', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  const data = await res.json();
  if (data.visitId) {
    currentVisitId = data.visitId;
    document.getElementById('checkinForm').style.display = 'none';
    document.getElementById('waiting').style.display = 'block';
    socket.emit('joinRoom', currentVisitId);
    document.getElementById('statusMessage').innerText = 'Request sent to owner...';
  } else {
    alert(data.error || 'Error');
  }
});

socket.on('owner_response', (data) => {
  if (data.visitId === currentVisitId) {
    if (data.status === 'approved') {
      document.getElementById('statusMessage').innerText = '✅ Approved - Allow Entry';
    } else {
      document.getElementById('statusMessage').innerText = '❌ Rejected - Do Not Allow';
    }
    setTimeout(() => {
      document.getElementById('checkinForm').style.display = 'block';
      document.getElementById('waiting').style.display = 'none';
      document.getElementById('checkinForm').reset();
    }, 3000);
  }
});