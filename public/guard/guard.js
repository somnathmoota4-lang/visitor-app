var token = localStorage.getItem('guardToken');
if (!token) window.location = 'login.html';

var socket = io();
var allRooms = [];
var visitorQueue = [];
var selectedFloor = null;
var selectedRoomId = null;

function loadRooms() {
  fetch('/api/guard/rooms', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(res => res.json())
    .then(rooms => {
      allRooms = rooms;
      renderFloors();
    })
    .catch(() => setTimeout(loadRooms, 10000));
}

function renderFloors() {
  const floors = [...new Set(allRooms.map(r => r.floor))].sort((a,b) => a-b);
  const container = document.getElementById('floorChips');
  container.innerHTML = '';
  floors.forEach(f => {
    const div = document.createElement('div');
    div.className = 'chip';
    div.textContent = 'Floor ' + f;
    div.onclick = () => { selectFloor(f, div); };
    container.appendChild(div);
  });
}

function selectFloor(floor, chip) {
  selectedFloor = floor;
  selectedRoomId = null;
  document.querySelectorAll('#floorChips .chip').forEach(c => c.classList.remove('selected'));
  chip.classList.add('selected');
  renderRooms();
}

function renderRooms() {
  const container = document.getElementById('roomChips');
  container.innerHTML = '';
  if (!selectedFloor) return;
  const rooms = allRooms.filter(r => r.floor == selectedFloor && r.owner);
  if (rooms.length === 0) {
    container.innerHTML = '<div style="color:#999;">No rooms with owners on this floor</div>';
    return;
  }
  rooms.forEach(room => {
    const div = document.createElement('div');
    div.className = 'chip';
    div.textContent = 'Room ' + room.roomNumber + ' - ' + room.owner.name;
    div.onclick = () => { selectRoom(room._id, div); };
    container.appendChild(div);
  });
}

function selectRoom(roomId, chip) {
  selectedRoomId = roomId;
  document.querySelectorAll('#roomChips .chip').forEach(c => c.classList.remove('selected'));
  chip.classList.add('selected');
}

function previewPhoto() {
  const file = document.getElementById('photo').files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = e => document.getElementById('photoPreview').innerHTML = `<img src="${e.target.result}">`;
    reader.readAsDataURL(file);
  }
}

function checkinVisitor() {
  const name = document.getElementById('name').value;
  const phone = document.getElementById('phone').value;
  const purpose = document.getElementById('purpose').value;
  const source = document.getElementById('visitorSource').value;
  if (!name || !phone || !purpose || !source || !selectedRoomId) { alert('Fill all fields and select room'); return; }

  const formData = new FormData();
  formData.append('name', name);
  formData.append('phone', phone);
  formData.append('purpose', purpose);
  formData.append('source', source);
  formData.append('roomId', selectedRoomId);
  const photoFile = document.getElementById('photo').files[0];
  if (photoFile) formData.append('photo', photoFile);

  fetch('/api/guard/checkin', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    if (data.visitId) {
      // Find room details for queue display
      const room = allRooms.find(r => r._id === selectedRoomId);
      visitorQueue.push({
        visitId: data.visitId,
        name, phone, purpose, source,
        room: room ? 'Room ' + room.roomNumber + ' - ' + room.owner.name : '',
        status: 'waiting',
        time: new Date().toLocaleTimeString()
      });
      socket.emit('joinRoom', data.visitId);
      // Clear form
      document.getElementById('name').value = '';
      document.getElementById('phone').value = '';
      document.getElementById('purpose').value = '';
      document.getElementById('visitorSource').value = '';
      document.getElementById('photo').value = '';
      document.getElementById('photoPreview').innerHTML = '<span style="font-size:30px;color:#999;">📷</span>';
      selectedRoomId = null;
      updateQueueCount();
      alert('✅ Visitor checked in! Waiting for approval.');
    } else {
      alert(data.error || 'Error');
    }
  });
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('checkinTab').style.display = 'none';
  document.getElementById('queueTab').style.display = 'none';
  document.getElementById('historyTab').style.display = 'none';
  if (tab === 'checkin') { document.querySelector('.tab:nth-child(1)').classList.add('active'); document.getElementById('checkinTab').style.display = 'block'; }
  else if (tab === 'queue') { document.querySelector('.tab:nth-child(2)').classList.add('active'); document.getElementById('queueTab').style.display = 'block'; updateQueueDisplay(); }
  else if (tab === 'history') { document.querySelector('.tab:nth-child(3)').classList.add('active'); document.getElementById('historyTab').style.display = 'block'; loadHistory(); }
}

function updateQueueCount() {
  const waiting = visitorQueue.filter(v => v.status === 'waiting');
  document.getElementById('queueCount').innerText = waiting.length;
}

function updateQueueDisplay() {
  const el = document.getElementById('queueList');
  if (!el) return;
  if (!visitorQueue.length) {
    el.innerHTML = '<div class="empty-state">No visitors in queue</div>';
    return;
  }
  let html = '';
  visitorQueue.slice().reverse().forEach(v => {
    const statusClass = v.status === 'waiting' ? 'status-waiting' : v.status === 'approved' ? 'status-approved' : 'status-rejected';
    const statusText = v.status === 'waiting' ? '⏳ Waiting' : v.status === 'approved' ? '✅ Approved' : '❌ Rejected';
    html += `<div class="visitor-queue-item">
      <div class="queue-info">
        <strong>${v.name}</strong>
        <small>📱 ${v.phone} | 🎯 ${v.purpose} | 🏢 ${v.source}</small>
        <small>🚪 ${v.room} | 🕐 ${v.time}</small>
      </div>
      <span class="visitor-status ${statusClass}">${statusText}</span>
    </div>`;
  });
  el.innerHTML = html;
  updateQueueCount();
}

function loadHistory() {
  fetch('/api/guard/today', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(res => res.json())
    .then(visitors => {
      const el = document.getElementById('historyList');
      if (!el) return;
      if (!visitors.length) { el.innerHTML = '<div class="empty-state">No visitors checked in today</div>'; return; }
      let html = '';
      visitors.forEach(v => {
        const statusColor = v.status === 'approved' ? 'green' : v.status === 'rejected' ? 'red' : 'orange';
        html += `<div style="padding:10px;border-bottom:1px solid #eee;">
          <strong>${v.name}</strong> <span style="color:${statusColor};">(${v.status})</span>
          <br><small>📱 ${v.phone} | 🎯 ${v.purpose} | 🏢 ${v.source || 'N/A'} | 🕐 ${new Date(v.entryTime).toLocaleTimeString()}</small>
        </div>`;
      });
      el.innerHTML = html;
    });
}

socket.on('owner_response', data => {
  visitorQueue.forEach(v => {
    if (v.visitId === data.visitId) v.status = data.status;
  });
  updateQueueDisplay();
  const visitor = visitorQueue.find(v => v.visitId === data.visitId);
  if (visitor) alert(data.status === 'approved' ? '✅ APPROVED - Allow Entry' : '❌ REJECTED - Deny Entry');
});

// Initial load
loadRooms();
