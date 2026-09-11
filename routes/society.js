const router = require('express').Router();
const auth = require('../middleware/auth');
const Complaint = require('../models/Complaint');

// Owner: Create complaint
router.post('/complaints', auth('owner'), async (req, res) => {
  try {
    const { title, category, description } = req.body;
    const complaint = await Complaint.create({
      owner: req.user.id,
      title, category, description
    });
    res.json({ message: 'Complaint registered', complaint });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Owner: Get my complaints
router.get('/complaints/my', auth('owner'), async (req, res) => {
  try {
    const complaints = await Complaint.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
