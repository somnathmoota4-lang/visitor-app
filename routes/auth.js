const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.role === 'owner' && user.status !== 'approved') return res.status(403).json({ error: 'Account not approved' });
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/activate-owner', async (req, res) => {
  const { token, password } = req.body;
  try {
    const user = await User.findOne({ activationToken: token });
    if (!user) return res.status(400).json({ error: 'Invalid token' });
    user.password = password; // hashed by pre-save
    user.activationToken = undefined;
    user.status = 'approved';
    await user.save();
    res.json({ message: 'Account activated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;