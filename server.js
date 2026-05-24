app.use("/api/auth", require("./routes/auth"));
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || "*", credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Ensure uploads dir exists
const fs = require("fs");
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// ── Database ───────────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/solarseva")
  .then(async () => {
    console.log("✅ MongoDB connected");
    // Seed admin if none exists
    const User = require("./models/User");
    const admin = await User.findOne({ role: "admin" });
    if (!admin) {
      await User.create({
        name: "SolarSeva Admin",
        phone: "6395869561",
        password: "arun9561",
        role: "admin",
        city: "Haldwani",
      });
      console.log("🔑 Admin seeded: phone=6395869561, password=arun9561");
    }
  })
  .catch((err) => console.error("MongoDB error:", err));

// ── Routes ─────────────────────────────────────────────────────────────────
app.use("/api/auth",     require("./routes/auth"));
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/admin",    require("./routes/admin"));

// Health check
app.get("/api/health", (req, res) => res.json({ status: "ok", time: new Date() }));

// ── Error Handler ──────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong." });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 SolarSeva API running → http://localhost:${PORT}`);
});
