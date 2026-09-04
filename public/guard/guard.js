// public/guard/guard.js

var token = localStorage.getItem('guardToken');
if (!token) {
  window.location = 'login.html';
}

var socket = io();
var allRooms = [];
var visitorQueue = [];

// ---------- LOAD ROOMS ----------
function loadRooms() {
  fetch('/api/guard/rooms', {
    headers: { 'Authorization': 'Bearer ' + token }
  })
  .then(function(res) { return res.json(); })
  .then(function(rooms) {
    allRooms = rooms;
    setupFloorSelect();
  })
  .catch(function(err) {
    console.error('Error loading rooms:', err);
    document.getElementById('ownerFloor').innerHTML = '<option value="">Error loading rooms</option>';
  });
}

// ---------- SETUP FLOOR SELECT ----------
function setupFloorSelect() {
  var floors = [];
  allRooms.forEach(function(room) {
    if (floors.indexOf(room.floor) === -1) floors.push(room.floor);
  });
  floors.sort(function(a, b) { return a - b; });

  var select = document.getElementById('ownerFloor');
  select.innerHTML = '<option value="">🏢 Select Floor</option>';
  floors.forEach(function(f) {
    select.innerHTML += '<option value="' + f + '">Floor ' + f + '</option>';
  });
}

// ---------- LOAD ROOMS BY FLOOR ----------
function loadRoomsByFloor() {
  var floor = document.getElementById('ownerFloor').value;
  var select = document.getElementById('roomId');
  select.innerHTML = '<option value="">🚪 Select Room</option>';

  if (!floor) return;

  var roomsOnFloor = allRooms.filter(function(room) {
    return room.floor == floor && room.owner;
  });

  if (roomsOnFloor.length === 0) {
    select.innerHTML = '<option value="">No rooms with owners on this floor</option>';
    return;
  }

  roomsOnFloor.forEach(function(room) {
    select.innerHTML += '<option value="' + room._id + '">Room ' + room.roomNumber + ' - ' + room.owner.name + '</option>';
  });
}

// ---------- PREVIEW PHOTO ----------
function previewPhoto() {
  var file = document.getElementById('photo').files[0];
  if (file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('photoPreview').innerHTML = '<img src="' + e.target.result + '">';
    };
    reader.readAsDataURL(file);
  }
}

// ---------- CHECK-IN VISITOR ----------
function checkinVisitor() {
  var name = document.getElementById('name').value;
  var phone = document.getElementById('phone').value;
  var purpose = document.getElementById('purpose').value;
  var source = document.getElementById('visitorSource').value;
  var roomId = document.getElementById('roomId').value;

  if (!name || !phone || !purpose || !source || !roomId) {
    alert('Please fill all required fields');
    return;
  }

  var formData = new FormData();
  formData.append('name', name);
  formData.append('phone', phone);
  formData.append('purpose', purpose);
  formData.append('source', source);
  formData.append('roomId', roomId);

  var photoFile = document.getElementById('photo').files[0];
  if (photoFile) {
    formData.append('photo', photoFile);
  }

  fetch('/api/guard/checkin', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: formData
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.visitId) {
      visitorQueue.push({
        visitId: data.visitId,
        name: name,
        phone: phone,
        purpose: purpose,
        source: source,
        room: document.getElementById('roomId').selectedOptions[0].textContent,
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

      updateQueueCount();
      alert('✅ Visitor checked in! Waiting for approval.');
    } else {
      alert(data.error || 'Error checking in');
    }
  })
  .catch(function(err) {
    console.error('Check-in error:', err);
    alert('Connection error');
  });
}

// ---------- TAB SWITCHING ----------
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  document.getElementById('checkinTab').style.display = 'none';
  document.getElementById('queueTab').style.display = 'none';
  document.getElementById('historyTab').style.display = 'none';

  if (tab === 'checkin') {
    document.querySelector('.tab:nth-child(1)').classList.add('active');
    document.getElementById('checkinTab').style.display = 'block';
  } else if (tab === 'queue') {
    document.querySelector('.tab:nth-child(2)').classList.add('active');
    document.getElementById('queueTab').style.display = 'block';
    updateQueueDisplay();
  } else if (tab === 'history') {
    document.querySelector('.tab:nth-child(3)').classList.add('active');
    document.getElementById('historyTab').style.display = 'block';
    loadHistory();
  }
}

// ---------- QUEUE ----------
function updateQueueCount() {
  var waiting = visitorQueue.filter(function(v) { return v.status === 'waiting'; });
  document.getElementById('queueCount').innerText = waiting.length;
}

function updateQueueDisplay() {
  var html = '';
  if (visitorQueue.length === 0) {
    html = '<div class="empty-state">No visitors in queue</div>';
  } else {
    visitorQueue.slice().reverse().forEach(function(v) {
      var statusClass = v.status === 'waiting' ? 'status-waiting' :
                        v.status === 'approved' ? 'status-approved' : 'status-rejected';
      var statusText = v.status === 'waiting' ? '⏳ Waiting' :
                       v.status === 'approved' ? '✅ Approved' : '❌ Rejected';
      html += '<div class="visitor-queue-item">' +
        '<div class="queue-info">' +
          '<strong>' + v.name + '</strong>' +
          '<small>📱 ' + v.phone + ' | 🎯 ' + v.purpose + ' | 🏢 ' + v.source + '</small>' +
          '<small>🚪 ' + v.room + ' | 🕐 ' + v.time + '</small>' +
        '</div>' +
        '<span class="visitor-status ' + statusClass + '">' + statusText + '</span>' +
      '</div>';
    });
  }
  document.getElementById('queueList').innerHTML = html;
  updateQueueCount();
}

// ---------- HISTORY ----------
function loadHistory() {
  fetch('/api/guard/today', {
    headers: { 'Authorization': 'Bearer ' + token }
  })
  .then(function(res) { return res.json(); })
  .then(function(visitors) {
    var html = '';
    if (!visitors.length) {
      html = '<div class="empty-state">No visitors checked in today</div>';
    } else {
      visitors.forEach(function(v) {
        var statusColor = v.status === 'approved' ? 'green' : v.status === 'rejected' ? 'red' : 'orange';
        html += '<div style="padding:10px;border-bottom:1px solid #eee;">' +
          '<strong>' + v.name + '</strong> <span style="color:' + statusColor + ';">(' + v.status + ')</span>' +
          '<br><small>📱 ' + v.phone + ' | 🎯 ' + v.purpose + ' | 🏢 ' + (v.source || 'N/A') + ' | 🕐 ' + new Date(v.entryTime).toLocaleTimeString() + '</small>' +
        '</div>';
      });
    }
    document.getElementById('historyList').innerHTML = html;
  })
  .catch(function(err) {
    console.error('Error loading history:', err);
    document.getElementById('historyList').innerHTML = '<p style="color:red;">Error loading history</p>';
  });
}

// ---------- SOCKET EVENTS ----------
socket.on('owner_response', function(data) {
  visitorQueue.forEach(function(v) {
    if (v.visitId === data.visitId) {
      v.status = data.status;
    }
  });
  updateQueueDisplay();
  var visitor = visitorQueue.find(function(v) { return v.visitId === data.visitId; });
  if (visitor) {
    alert(data.status === 'approved' ? '✅ APPROVED - Allow Entry' : '❌ REJECTED - Deny Entry');
  }
});

// ---------- INITIAL LOAD ----------
loadRooms();
