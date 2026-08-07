const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Check password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Check if account is approved
    if (user.status !== 'approved') {
      return res.status(403).json({ error: 'Your account is not approved yet. Please contact the administrator.' });
    }
    
    // Create JWT token
    const token = jwt.sign(
      { 
        id: user._id, 
        role: user.role, 
        name: user.name,
        email: user.email
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    // Return token and user info
    res.json({ 
      success: true,
      token: token, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        room: user.room || null
      } 
    });
    
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// Activate owner account (via email link)
router.post('/activate-owner', async (req, res) => {
  const { token, password } = req.body;
  
  try {
    const user = await User.findOne({ activationToken: token });
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired activation link' });
    }
    
    // Set new password
    user.password = password; // Will be hashed by pre-save hook
    user.activationToken = undefined;
    user.status = 'approved';
    await user.save();
    
    res.json({ message: 'Account activated successfully! You can now login.' });
    
  } catch (err) {
    console.error('Activation error:', err);
    res.status(500).json({ error: 'Activation failed. Please try again.' });
  }
});

// Verify token (check if user is still logged in)
router.get('/verify', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ 
      valid: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
    
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Change password (for any logged-in user)
router.post('/change-password', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const { currentPassword, newPassword } = req.body;
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Verify current password
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    
    // Set new password
    user.password = newPassword; // Will be hashed by pre-save hook
    await user.save();
    
    res.json({ message: 'Password changed successfully' });
    
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
