const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });
    if (user.status !== 'approved') return res.status(403).json({ error: 'Account not approved' });

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Activate owner
router.post('/activate-owner', async (req, res) => {
  const { token, password } = req.body;
  try {
    const user = await User.findOne({ activationToken: token });
    if (!user) return res.status(400).json({ error: 'Invalid activation link' });
    user.password = password;
    user.activationToken = undefined;
    user.status = 'approved';
    await user.save();
    res.json({ message: 'Account activated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify token
router.get('/verify', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Forgot Password - Send OTP
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'No account with this email' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetOTP = otp;
    user.resetOTPExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();
    const msg = {
      to: email,
      from: 'somnathmoota4@gmail.com',
      subject: 'Your Password Reset OTP',
      text: `Your OTP is ${otp}. Valid for 10 minutes.`,
      html: `<h3>Password Reset OTP</h3><p>Your OTP is <strong>${otp}</strong>. Valid for 10 minutes.</p>`
    };
    await sgMail.send(msg);
    res.json({ message: 'OTP sent to your email' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Reset Password with OTP
router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  try {
    const user = await User.findOne({ email, resetOTP: otp, resetOTPExpires: { $gt: new Date() } });
    if (!user) return res.status(400).json({ error: 'Invalid or expired OTP' });
    user.password = newPassword;
    user.resetOTP = undefined;
    user.resetOTPExpires = undefined;
    await user.save();
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Request password change OTP (for logged-in user)
router.post('/request-password-change', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetOTP = otp;
    user.resetOTPExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    const msg = {
      to: user.email,
      from: 'somnathmoota4@gmail.com',
      subject: 'Your Password Change OTP',
      text: `Your OTP to change password is ${otp}. Valid for 10 minutes.`,
      html: `<h3>Change Password OTP</h3><p>Your OTP is <strong>${otp}</strong>. Valid for 10 minutes.</p>`
    };
    await sgMail.send(msg);
    res.json({ message: 'OTP sent to your email' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Change password with OTP
router.post('/change-password-otp', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  const { otp, newPassword } = req.body;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.resetOTP !== otp || !user.resetOTPExpires || new Date() > user.resetOTPExpires) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }
    user.password = newPassword;
    user.resetOTP = undefined;
    user.resetOTPExpires = undefined;
    await user.save();
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
