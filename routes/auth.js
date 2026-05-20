const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { protect } = require("../middleware/auth");

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

// POST /api/auth/register
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

// POST /api/auth/login
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

// GET /api/auth/me — Get current user
router.get("/me", protect, (req, res) => {
  res.json({ success: true, user: req.user });
});

// PATCH /api/auth/update — Update profile
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

// POST /api/auth/change-password
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
