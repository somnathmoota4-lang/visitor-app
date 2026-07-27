const token = localStorage.getItem('ownerToken');
if (!token) window.location = 'login.html'; // we need an owner login page, we'll create later

async function loadPending() {
  const res = await fetch('/api/owner/pending', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const visitors = await res.json();
  const html = visitors.map(v => `
    <div style="border:1px solid #ccc; padding:10px; margin:10px 0;">
      <img src="${v.photo}" width="100"><br>
      <b>${v.name}</b><br>
      Phone: ${v.phone}<br>
      Purpose: ${v.purpose}<br>
      Room: ${v.room.roomNumber}<br>
      <button onclick="respond('${v._id}', 'approve')">Approve</button>
      <button onclick="respond('${v._id}', 'reject')">Reject</button>
    </div>
  `).join('');
  document.getElementById('visitorList').innerHTML = html || '<p>No pending visitors</p>';
}

async function respond(visitId, action) {
  await fetch('/api/owner/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ visitId, action })
  });
  loadPending();
}

loadPending();
setInterval(loadPending, 5000);