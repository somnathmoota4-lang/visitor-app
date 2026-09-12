var token = localStorage.getItem('guardToken');
if (!token) window.location = 'login.html';

// ====================================================
// FIREBASE PUSH NOTIFICATIONS FOR GUARD
// ====================================================
var firebaseConfig = {
  apiKey: "AIzaSyAgdLSNm6vG-ZQ2P9B7WtZuiJYvywj6L_Y",
  authDomain: "visitor-app-push-47fd8.firebaseapp.com",
  projectId: "visitor-app-push-47fd8",
  storageBucket: "visitor-app-push-47fd8.firebasestorage.app",
  messagingSenderId: "452927501608",
  appId: "1:452927501608:web:d9ad76cb143bcea7ed0c1d"
};

// ⚠️ REPLACE THIS with your real VAPID key
var VAPID_KEY = "BH_fQwewsSrJ7DLHFS3ORQIb16gxEOHMnYTRCIKPhdjhwheqBGkHh6HGWzNlSUYHxR6-4ukqF9LmswUh1jLdFLM";

try {
  firebase.initializeApp(firebaseConfig);
  var messaging = firebase.messaging();

  messaging.onMessage(function(payload) {
    console.log('🔔 Foreground message:', payload);
    var title = (payload.notification && payload.notification.title) || 'Guard Alert';
    var body = (payload.notification && payload.notification.body) || 'Owner responded';
    if (Notification.permission === 'granted') {
      new Notification(title, { body: body });
    }
    // Refresh queue display
    if (typeof updateQueueDisplay === 'function') updateQueueDisplay();
    if (typeof loadHistory === 'function') loadHistory();
  });

  function setupGuardToken() {
    Notification.requestPermission()
      .then(function(permission) {
        console.log('🔔 Guard permission:', permission);
        if (permission === 'granted') {
          return navigator.serviceWorker.register('/guard/firebase-messaging-sw.js')
            .then(function(registration) {
              console.log('✅ Guard SW registered');
              return messaging.getToken({
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration
              });
            });
        } else {
          throw new Error('Permission not granted');
        }
      })
      .then(function(fcmToken) {
        if (!fcmToken) throw new Error('No FCM token');
        console.log('📱 Guard FCM Token:', fcmToken);
        return fetch('/api/guard/fcm-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ token: fcmToken })
        });
      })
      .then(function(res) { return res.json(); })
      .then(function(data) { console.log('✅ Guard FCM token saved:', data); })
      .catch(function(err) { console.log('⚠️ Guard push setup:', err.message); });
  }

  setTimeout(setupGuardToken, 1000);
} catch (err) {
  console.log('⚠️ Guard Firebase init skipped:', err.message);
}
// ====================================================
var socket = io();
var allRooms = [];
var visitorQueue = [];
var selectedFloor = null;
var selectedRoomNumber = null;

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
  if (floors.length === 0) {
    container.innerHTML = '<div style="color:#999;">No rooms available</div>';
    return;
  }
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
  selectedRoomNumber = null;
  document.querySelectorAll('#floorChips .chip').forEach(c => c.classList.remove('selected'));
  chip.classList.add('selected');
  renderRooms();
}

function renderRooms() {
  const container = document.getElementById('roomChips');
  container.innerHTML = '';
  if (!selectedFloor) return;
  const rooms = allRooms.filter(r => r.floor == selectedFloor);
  if (rooms.length === 0) {
    container.innerHTML = '<div style="color:#999;">No rooms with owners on this floor</div>';
    return;
  }
  rooms.forEach(room => {
    const div = document.createElement('div');
    div.className = 'chip';
    div.textContent = 'Room ' + room.roomNumber + ' - ' + room.owner.name;
    div.onclick = () => { selectRoom(room.roomNumber, div); };
    container.appendChild(div);
  });
}

function selectRoom(roomNumber, chip) {
  selectedRoomNumber = roomNumber;
  document.querySelectorAll('#roomChips .chip').forEach(c => c.classList.remove('selected'));
  chip.classList.add('selected');
}

function openCamera() {
  document.getElementById('photo').click();
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
  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const purpose = document.getElementById('purpose').value;
  const source = document.getElementById('visitorSource').value;
  const btn = document.getElementById('checkinBtn');

  if (!name || !phone || !purpose || !source || !selectedRoomNumber) {
    alert('Please fill all fields and select floor + room');
    return;
  }

  const formData = new FormData();
  formData.append('name', name);
  formData.append('phone', phone);
  formData.append('purpose', purpose);
  formData.append('source', source);
  formData.append('roomId', selectedRoomNumber);
  const photoFile = document.getElementById('photo').files[0];
  if (photoFile) formData.append('photo', photoFile);

  btn.disabled = true;
  btn.innerText = '⏳ Checking in...';

  fetch('/api/guard/checkin', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    btn.disabled = false;
    btn.innerText = '✅ Check In Visitor';
    if (data.visitId) {
      const room = allRooms.find(r => r.roomNumber === selectedRoomNumber);
      visitorQueue.push({
        visitId: data.visitId,
        name, phone, purpose, source,
        room: room ? 'Room ' + room.roomNumber + ' - ' + room.owner.name : selectedRoomNumber,
        status: 'waiting',
        time: new Date().toLocaleTimeString()
      });
      socket.emit('joinRoom', data.visitId);
      document.getElementById('name').value = '';
      document.getElementById('phone').value = '';
      document.getElementById('purpose').value = '';
      document.getElementById('visitorSource').value = '';
      document.getElementById('photo').value = '';
      document.getElementById('photoPreview').innerHTML = '<span style="font-size:30px;color:#999;">📷</span>';
      selectedRoomNumber = null;
      document.querySelectorAll('#roomChips .chip').forEach(c => c.classList.remove('selected'));
      updateQueueCount();
      alert('✅ Visitor checked in! Waiting for owner approval.');
    } else {
      alert(data.error || 'Error');
    }
  })
  .catch(err => {
    btn.disabled = false;
    btn.innerText = '✅ Check In Visitor';
    alert('Connection error');
    console.error(err);
  });
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('checkinTab').style.display = 'none';
  document.getElementById('queueTab').style.display = 'none';
  document.getElementById('historyTab').style.display = 'none';
  document.getElementById('profileTab').style.display = 'none';

  if (tab === 'checkin') {
    document.querySelectorAll('.tab')[0].classList.add('active');
    document.getElementById('checkinTab').style.display = 'block';
  } else if (tab === 'queue') {
    document.querySelectorAll('.tab')[1].classList.add('active');
    document.getElementById('queueTab').style.display = 'block';
    updateQueueDisplay();
  } else if (tab === 'history') {
    document.querySelectorAll('.tab')[2].classList.add('active');
    document.getElementById('historyTab').style.display = 'block';
    loadHistory();
  } else if (tab === 'profile') {
    document.querySelectorAll('.tab')[3].classList.add('active');
    document.getElementById('profileTab').style.display = 'block';
    loadGuardProfile();
  }
}

function updateQueueCount() {
  const waiting = visitorQueue.filter(v => v.status === 'waiting');
  const el = document.getElementById('queueCount');
  if (el) el.innerText = waiting.length;
}

function updateQueueDisplay() {
  const el = document.getElementById('queueList');
  if (!el) return;
  if (!visitorQueue.length) { el.innerHTML = '<div class="empty-state">No visitors in queue</div>'; return; }
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
          <br><small>📱 ${v.phone} | 🎯 ${v.purpose} | 🏢 ${v.source || 'N/A'} | 🚪 Room ${v.roomNumber || '-'} | 🕐 ${new Date(v.entryTime).toLocaleTimeString()}</small>
        </div>`;
      });
      el.innerHTML = html;
    });
}

function loadGuardProfile() {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    document.getElementById('guardProfile').innerHTML = `
      <div style="text-align:center;">
        <div style="font-size:50px;">🛡️</div>
        <h4>${payload.name || 'Guard'}</h4>
        <p style="color:#666;">${payload.email || ''}</p>
        <p style="color:#999;">Role: Guard</p>
      </div>`;
  } catch(e) {
    document.getElementById('guardProfile').innerHTML = '<p>Error loading profile</p>';
  }
}

function logout() {
  localStorage.removeItem('guardToken');
  window.location = 'login.html';
}

socket.on('owner_response', data => {
  visitorQueue.forEach(v => { if (v.visitId === data.visitId) v.status = data.status; });
  updateQueueDisplay();
  const visitor = visitorQueue.find(v => v.visitId === data.visitId);
  if (visitor) alert(data.status === 'approved' ? '✅ APPROVED - Allow Entry' : '❌ REJECTED - Deny Entry');
});

loadRooms();
