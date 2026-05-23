const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Booking = require("../models/Booking");
const { protect, restrictTo } = require("../middleware/auth");

// All admin routes require auth + admin role
router.use(protect, restrictTo("admin"));

// GET /api/admin/users — All users
router.get("/users", async (req, res) => {
  const { role, page = 1, limit = 20 } = req.query;
  const filter = role ? { role } : {};
  const users = await User.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));
  const total = await User.countDocuments(filter);
  res.json({ success: true, users, total });
});

// POST /api/admin/technicians — Add technician
router.post("/technicians", async (req, res) => {
  try {
    const { name, phone, email, password, city } = req.body;
    const tech = await User.create({ name, phone, email, password, city, role: "technician" });
    res.status(201).json({ success: true, user: tech });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/admin/technicians/:id — Delete technician
router.delete("/technicians/:id", async (req, res) => {
  try {

    const technician = await User.findById(req.params.id);

    if (!technician) {
      return res.status(404).json({
        error: "Technician not found",
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Technician deleted successfully",
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Delete failed",
    });
  }
});

// PATCH /api/admin/users/:id — Toggle active status
router.patch("/users/:id", async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/admin/overview — Full dashboard overview
router.get("/overview", async (req, res) => {
  const [
    totalUsers, totalTechs, totalBookings,
    recentBookings, topCities
  ] = await Promise.all([
    User.countDocuments({ role: "customer" }),
    User.countDocuments({ role: "technician" }),
    Booking.countDocuments(),
    Booking.find().sort({ createdAt: -1 }).limit(5).populate("userId", "name"),
    Booking.aggregate([
      { $group: { _id: "$city", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
  ]);
  res.json({ success: true, totalUsers, totalTechs, totalBookings, recentBookings, topCities });
});

module.exports = router;
