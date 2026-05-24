const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { protect } = require("../middleware/auth");
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ===== Helper Function =====
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

// ===== GOOGLE LOGIN =====
router.post('/google-login', async (req, res) => {
  try {
    const { token } = req.body;
    
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { email, name, picture } = ticket.getPayload();
    
    let user = await User.findOne({ email });
    
    if (!user) {
      const phone = email.split('@')[0];
      user = await User.create({
        name, 
        email, 
        phone,
        password: Math.random().toString(36).slice(-20),
        avatar: picture,
        role: 'customer',
        city: 'Haldwani',
      });
    }

    const jwtToken = signToken(user._id);
    res.json({ success: true, token: jwtToken, user });
  } catch (err) {
    console.error('Google login error:', err);
    res.status(400).json({ error: 'Google login failed: ' + err.message });
  }
});

// ===== REGISTER =====
router.post("/register", async (req, res) => {
  try {
    const { name, phone, email, password, city } = req.body;

    const existing = await User.findOne({ phone });
    if (existing) return res.status(400).json({ error: "Phone number already registered." });

    const user = await User.create({ name, phone, email, password, city });
    const token = signToken(user._id);

    res.status(201).json({ success: true, token, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===== LOGIN =====
router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password)
      return res.status(400).json({ error: "Phone and password required." });

    const user = await User.findOne({ phone }).select("+password");
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: "Invalid phone or password." });

    if (!user.isActive)
      return res.status(401).json({ error: "Account deactivated. Contact support." });

    const token = signToken(user._id);
    user.password = undefined;

    res.json({ success: true, token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== GET CURRENT USER =====
router.get("/me", protect, (req, res) => {
  res.json({ success: true, user: req.user });
});

// ===== UPDATE PROFILE =====
router.patch("/update", protect, async (req, res) => {
  try {
    const { name, email, address, city } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, email, address, city },
      { new: true, runValidators: true }
    );
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ===== CHANGE PASSWORD =====
router.post("/change-password", protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select("+password");

    if (!(await user.comparePassword(currentPassword)))
      return res.status(400).json({ error: "Current password is incorrect." });

    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: "Password updated." });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;