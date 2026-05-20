const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const crypto = require("crypto");
const multer = require("multer");
const path = require("path");
const Booking = require("../models/Booking");
const User = require("../models/User");
const { protect, restrictTo } = require("../middleware/auth");
const wa = require("../utils/whatsapp");

// Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Multer for screenshot uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, `pay_${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const genBookingId = () => "SS" + Date.now().toString().slice(-7);

const PLAN_PRICES = { Basic: 299, Standard: 499, Premium: 799 };

// ── POST /api/bookings — Create booking ───────────────────────────────────
router.post("/", protect, async (req, res) => {
  try {
    const { name, phone, address, city, service, plan, panels, date, time, paymentMethod } = req.body;

    const amount = PLAN_PRICES[plan] || 499;

    const booking = await Booking.create({
      bookingId: genBookingId(),
      userId: req.user._id,
      name, phone, address, city, service, plan, panels,
      date, time, amount, paymentMethod,
    });

    // Auto-assign technician
    const tech = await User.findOne({ role: "technician", city, isActive: true });
    if (tech) {
      booking.technicianId = tech._id;
      booking.status = "assigned";
      await booking.save();
      await wa.sendTechnicianAssigned(booking, tech);
    }

    res.status(201).json({ success: true, booking });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/bookings/create-order — Create Razorpay order ───────────────
router.post("/create-order", protect, async (req, res) => {
  try {
    const { amount, bookingId } = req.body;
    const order = await razorpay.orders.create({
      amount: amount * 100, // paise
      currency: "INR",
      receipt: bookingId,
      notes: { bookingId },
    });
    res.json({ success: true, order, key: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/bookings/verify-payment — Verify Razorpay signature ─────────
router.post("/verify-payment", protect, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Payment verification failed." });
    }

    const booking = await Booking.findOneAndUpdate(
      { bookingId },
      {
        paymentStatus: "paid",
        status: "confirmed",
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
      },
      { new: true }
    );

    // WhatsApp confirmation
    await wa.sendBookingConfirmation(booking);

    res.json({ success: true, booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/bookings/:id/screenshot — Upload manual UPI screenshot ──────
router.post("/:id/screenshot", protect, upload.single("screenshot"), async (req, res) => {
  try {
    const booking = await Booking.findOneAndUpdate(
      { bookingId: req.params.id },
      { screenshotUrl: `/uploads/${req.file.filename}`, paymentStatus: "paid", status: "confirmed" },
      { new: true }
    );
    if (!booking) return res.status(404).json({ error: "Booking not found." });

    await wa.sendBookingConfirmation(booking);
    res.json({ success: true, booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/bookings/my — Customer's bookings ────────────────────────────
router.get("/my", protect, async (req, res) => {
  const bookings = await Booking.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .populate("technicianId", "name phone");
  res.json({ success: true, bookings });
});

// ── GET /api/bookings — All bookings (admin) ──────────────────────────────
router.get("/", protect, restrictTo("admin"), async (req, res) => {
  const { status, city, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (city) filter.city = city;

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("userId", "name phone")
      .populate("technicianId", "name phone"),
    Booking.countDocuments(filter),
  ]);

  res.json({ success: true, bookings, total, pages: Math.ceil(total / limit) });
});

// ── GET /api/bookings/stats — Dashboard stats (admin) ────────────────────
router.get("/stats", protect, restrictTo("admin"), async (req, res) => {
  const [total, pending, confirmed, completed, revenue] = await Promise.all([
    Booking.countDocuments(),
    Booking.countDocuments({ status: "pending" }),
    Booking.countDocuments({ status: { $in: ["confirmed", "assigned"] } }),
    Booking.countDocuments({ status: "completed" }),
    Booking.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  // Last 7 days revenue
  const last7 = await Booking.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        paymentStatus: "paid",
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        revenue: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.json({
    success: true,
    stats: {
      total, pending, confirmed, completed,
      revenue: revenue[0]?.total || 0,
      last7Days: last7,
    },
  });
});

// ── PATCH /api/bookings/:id/status — Update status (admin) ───────────────
router.patch("/:id/status", protect, restrictTo("admin"), async (req, res) => {
  try {
    const { status, technicianId } = req.body;
    const booking = await Booking.findOneAndUpdate(
      { bookingId: req.params.id },
      { status, ...(technicianId && { technicianId }) },
      { new: true }
    ).populate("technicianId", "name phone");

    if (status === "completed") await wa.sendServiceCompleted(booking);
    if (status === "assigned" && booking.technicianId)
      await wa.sendTechnicianAssigned(booking, booking.technicianId);

    res.json({ success: true, booking });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/bookings/:id/rate — Rate completed service ──────────────────
router.post("/:id/rate", protect, async (req, res) => {
  try {
    const { rating, review } = req.body;
    const booking = await Booking.findOneAndUpdate(
      { bookingId: req.params.id, userId: req.user._id },
      { rating, review },
      { new: true }
    );
    res.json({ success: true, booking });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
