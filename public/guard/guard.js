<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Visitor Check-in</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f5; min-height: 100vh; }
    .header { background: linear-gradient(135deg, #1a237e, #283593); color: white; padding: 15px; text-align: center; }
    .container { max-width: 500px; margin: 10px auto; padding: 10px; }
    .card { background: white; padding: 15px; margin: 10px 0; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .card h3 { color: #1a237e; margin-bottom: 12px; font-size: 16px; }
    input, select, button { width: 100%; padding: 12px; margin: 6px 0; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px; }
    button { background: #1a237e; color: white; border: none; font-weight: bold; cursor: pointer; }
    .btn-green { background: #2e7d32; }
    .btn-red { background: #c62828; }
    .photo-btn { background: #e3f2fd; color: #1a237e; border: 2px dashed #1a237e; text-align: center; padding: 15px; border-radius: 10px; cursor: pointer; }
    .photo-preview { width: 80px; height: 80px; border-radius: 50%; background: #e0e0e0; margin: 10px auto; overflow: hidden; }
    .photo-preview img { width: 100%; height: 100%; object-fit: cover; }
    .tabs { display: flex; background: white; }
    .tab { flex: 1; padding: 12px; text-align: center; cursor: pointer; font-weight: bold; color: #666; border-bottom: 3px solid transparent; font-size: 14px; }
    .tab.active { color: #1a237e; border-bottom-color: #1a237e; }
    .count-badge { background: #ff6f00; color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px; }
    .visitor-queue-item { display: flex; align-items: center; padding: 12px; border-bottom: 1px solid #eee; gap: 10px; }
    .visitor-status { font-size: 12px; padding: 4px 8px; border-radius: 12px; font-weight: bold; }
    .status-waiting { background: #fff3e0; color: #e65100; }
    .status-approved { background: #e8f5e9; color: #2e7d32; }
    .status-rejected { background: #ffebee; color: #c62828; }
    .queue-info { flex: 1; }
    .queue-info strong { font-size: 14px; }
    .queue-info small { font-size: 11px; color: #666; display: block; }
    .empty-state { text-align: center; padding: 30px; color: #999; }
  </style>
</head>
<body>
  <div class="header"><h2>📋 Visitor Management</h2></div>

  <div class="tabs">
    <div class="tab active" onclick="switchTab('checkin')">✍️ Check-in</div>
    <div class="tab" onclick="switchTab('queue')">📊 Queue <span class="count-badge" id="queueCount">0</span></div>
    <div class="tab" onclick="switchTab('history')">📜 History</div>
  </div>

  <div class="container">
    <!-- CHECK-IN TAB -->
    <div id="checkinTab">
      <div class="card">
        <h3>Visitor Details</h3>
        <input type="text" id="name" placeholder="👤 Visitor Full Name" required>
        <input type="tel" id="phone" placeholder="📱 Phone Number" required>
        <select id="visitorSource" required>
          <option value="">🏢 Where from?</option>
          <option value="office">Office</option>
          <option value="blinkit">Blinkit</option>
          <option value="zepto">Zepto</option>
          <option value="swiggy">Swiggy</option>
          <option value="zomato">Zomato</option>
          <option value="bluedart">Blue Dart</option>
          <option value="shadowfax">Shadowfax</option>
          <option value="other">Other</option>
        </select>
        <select id="purpose" required>
          <option value="">🎯 Select Purpose</option>
          <option>Meeting</option>
          <option>Delivery</option>
          <option>Maintenance</option>
          <option>Personal Visit</option>
          <option>Interview</option>
          <option>Courier</option>
          <option>Food Delivery</option>
          <option>Other</option>
        </select>
      </div>

      <div class="card">
        <h3>Destination</h3>
        <button type="button" onclick="loadRooms()" style="background:#e0e0e0;color:#333;padding:8px;width:auto;">🔄 Refresh</button>
        <select id="ownerFloor" onchange="loadRoomsByFloor()" required>
          <option value="">🏢 Select Floor</option>
        </select>
        <select id="roomId" required>
          <option value="">🚪 First select floor</option>
        </select>
      </div>

      <div class="card">
        <h3>Photo (Optional)</h3>
        <div class="photo-preview" id="photoPreview"><span style="font-size:30px;color:#999;">📷</span></div>
        <input type="file" id="photo" accept="image/*" capture="environment" onchange="previewPhoto()" style="display:none;">
        <button type="button" class="photo-btn" onclick="document.getElementById('photo').click()">📸 Take Photo</button>
      </div>

      <button class="btn" onclick="checkinVisitor()" style="font-size:18px;padding:15px;">✅ Check In Visitor</button>
    </div>

    <!-- QUEUE TAB -->
    <div id="queueTab" style="display:none;">
      <div class="card">
        <h3>📊 Current Queue</h3>
        <div id="queueList"><div class="empty-state">No visitors in queue</div></div>
      </div>
    </div>

    <!-- HISTORY TAB -->
    <div id="historyTab" style="display:none;">
      <div class="card">
        <h3>📜 Past Check-ins</h3>
        <div id="historyList"><p>Loading...</p></div>
      </div>
    </div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    var token = localStorage.getItem('guardToken');
    if (!token) window.location = 'login.html';

    var socket = io();
    var allRooms = [];
    var visitorQueue = [];

    // Load rooms function with retry
    function loadRooms() {
      fetch('/api/guard/rooms', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(res => res.json())
        .then(rooms => {
          allRooms = rooms;
          setupFloorSelect();
        })
        .catch(() => {
          document.getElementById('ownerFloor').innerHTML = '<option value="">Error loading rooms</option>';
        });
    }

    function setupFloorSelect() {
      var floors = [];
      allRooms.forEach(r => { if (floors.indexOf(r.floor) === -1) floors.push(r.floor); });
      floors.sort((a,b) => a-b);
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
      roomsOnFloor.forEach(r => select.innerHTML += `<option value="${r._id}">Room ${r.roomNumber} - ${r.owner.name}</option>`);
    }

    function previewPhoto() {
      var file = document.getElementById('photo').files[0];
      if (file) {
        var reader = new FileReader();
        reader.onload = e => document.getElementById('photoPreview').innerHTML = `<img src="${e.target.result}">`;
        reader.readAsDataURL(file);
      }
    }

    function checkinVisitor() {
      var name = document.getElementById('name').value;
      var phone = document.getElementById('phone').value;
      var purpose = document.getElementById('purpose').value;
      var source = document.getElementById('visitorSource').value;
      var roomId = document.getElementById('roomId').value;
      if (!name || !phone || !purpose || !roomId || !source) { alert('Please fill all fields'); return; }

      var formData = new FormData();
      formData.append('name', name);
      formData.append('phone', phone);
      formData.append('purpose', purpose);
      formData.append('source', source);
      formData.append('roomId', roomId);
      var photoFile = document.getElementById('photo').files[0];
      if (photoFile) formData.append('photo', photoFile);

      fetch('/api/guard/checkin', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        body: formData
      })
      .then(res => res.json())
      .then(data => {
        if (data.visitId) {
          visitorQueue.push({ visitId: data.visitId, name, phone, purpose, source, room: document.getElementById('roomId').selectedOptions[0].textContent, status: 'waiting', time: new Date().toLocaleTimeString() });
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
          alert(data.error || 'Error');
        }
      });
    }

    function switchTab(tab) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
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

    function updateQueueCount() {
      var waiting = visitorQueue.filter(v => v.status === 'waiting');
      document.getElementById('queueCount').innerText = waiting.length;
    }

    function updateQueueDisplay() {
      var html = '';
      if (visitorQueue.length === 0) html = '<div class="empty-state">No visitors in queue</div>';
      else {
        visitorQueue.slice().reverse().forEach(v => {
          var statusClass = v.status === 'waiting' ? 'status-waiting' : v.status === 'approved' ? 'status-approved' : 'status-rejected';
          var statusText = v.status === 'waiting' ? '⏳ Waiting' : v.status === 'approved' ? '✅ Approved' : '❌ Rejected';
          html += `<div class="visitor-queue-item">
            <div class="queue-info"><strong>${v.name}</strong><small>📱 ${v.phone} | 🎯 ${v.purpose} | 🏢 ${v.source}</small><small>🚪 ${v.room} | 🕐 ${v.time}</small></div>
            <span class="visitor-status ${statusClass}">${statusText}</span>
          </div>`;
        });
      }
      document.getElementById('queueList').innerHTML = html;
      updateQueueCount();
    }

    function loadHistory() {
      fetch('/api/guard/today', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(res => res.json())
        .then(visitors => {
          let html = '';
          if (!visitors.length) html = '<div class="empty-state">No visitors checked in today</div>';
          else {
            visitors.forEach(v => {
              var statusColor = v.status === 'approved' ? 'green' : v.status === 'rejected' ? 'red' : 'orange';
              html += `<div style="padding:10px;border-bottom:1px solid #eee;">
                <strong>${v.name}</strong> <span style="color:${statusColor};">(${v.status})</span>
                <br><small>📱 ${v.phone} | 🎯 ${v.purpose} | 🏢 ${v.source || 'N/A'} | 🕐 ${new Date(v.entryTime).toLocaleTimeString()}</small>
              </div>`;
            });
          }
          document.getElementById('historyList').innerHTML = html;
        });
    }

    socket.on('owner_response', data => {
      visitorQueue.forEach(v => { if (v.visitId === data.visitId) v.status = data.status; });
      updateQueueDisplay();
      var visitor = visitorQueue.find(v => v.visitId === data.visitId);
      if (visitor) alert(data.status === 'approved' ? '✅ APPROVED - Allow Entry' : '❌ REJECTED - Deny Entry');
    });

    // Initial load
    loadRooms();
  </script>
</body>
</html>
