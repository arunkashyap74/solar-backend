const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  bookingId:     { type: String, unique: true },
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  name:          { type: String, required: true },
  phone:         { type: String, required: true },
  address:       { type: String, required: true },
  city:          { type: String, required: true },
  service:       { type: String, required: true },
  plan:          { type: String, enum: ["Basic", "Standard", "Premium", "Custom"], default: "Basic" },
  panels:        { type: Number },
  date:          { type: String, required: true },
  time:          { type: String, required: true },
  amount:        { type: Number, required: true },
  
  // Payment
  paymentMethod: { type: String, enum: ["razorpay", "upi_manual", "cash"], default: "razorpay" },
  paymentStatus: { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
  razorpayOrderId:   { type: String },
  razorpayPaymentId: { type: String },
  screenshotUrl: { type: String },

  // Status
  status: {
    type: String,
    enum: ["pending", "confirmed", "assigned", "in_progress", "completed", "cancelled"],
    default: "pending",
  },
  technicianId:  { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  notes:         { type: String },
  rating:        { type: Number, min: 1, max: 5 },
  review:        { type: String },
  createdAt:     { type: Date, default: Date.now },
  updatedAt:     { type: Date, default: Date.now },
});

bookingSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("Booking", bookingSchema);
