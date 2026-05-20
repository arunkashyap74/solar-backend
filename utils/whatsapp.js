const axios = require("axios");

const WA_API_URL = `https://graph.facebook.com/v18.0/${process.env.WA_PHONE_NUMBER_ID}/messages`;

const headers = () => ({
  Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
  "Content-Type": "application/json",
});

// ── Send a plain text message ──────────────────────────────────────────────
async function sendTextMessage(to, text) {
  try {
    const phone = to.replace(/\D/g, "");
    const intlPhone = phone.startsWith("91") ? phone : `91${phone}`;

    await axios.post(WA_API_URL, {
      messaging_product: "whatsapp",
      to: intlPhone,
      type: "text",
      text: { body: text },
    }, { headers: headers() });

    console.log(`✅ WhatsApp sent to ${intlPhone}`);
  } catch (err) {
    console.error("WhatsApp error:", err.response?.data || err.message);
  }
}

// ── Booking Confirmation Message ───────────────────────────────────────────
async function sendBookingConfirmation(booking) {
  const message =
    `🌞 *SolarSeva – Booking Confirmed!*\n\n` +
    `Hello ${booking.name},\n\n` +
    `Your booking is confirmed ✅\n\n` +
    `📋 *Booking Details:*\n` +
    `• ID: ${booking.bookingId}\n` +
    `• Service: ${booking.service}\n` +
    `• Plan: ${booking.plan}\n` +
    `• Date: ${booking.date}\n` +
    `• Time: ${booking.time}\n` +
    `• Amount: ₹${booking.amount}\n\n` +
    `📍 *Address:* ${booking.address}, ${booking.city}\n\n` +
    `Our team will contact you shortly to assign a technician.\n\n` +
    `Need help? Reply to this message or call us at *+91 98765 43210*\n\n` +
    `_Thank you for choosing SolarSeva!_ ⚡`;

  await sendTextMessage(booking.phone, message);
}

// ── Technician Assigned Message ────────────────────────────────────────────
async function sendTechnicianAssigned(booking, technician) {
  const message =
    `⚡ *Technician Assigned – SolarSeva*\n\n` +
    `Hello ${booking.name},\n\n` +
    `Your technician has been assigned!\n\n` +
    `👷 *Technician:* ${technician.name}\n` +
    `📞 *Contact:* ${technician.phone}\n` +
    `⭐ *Rating:* ${technician.rating}/5\n\n` +
    `They will arrive on *${booking.date}* between *${booking.time}*.\n\n` +
    `Booking ID: ${booking.bookingId}`;

  await sendTextMessage(booking.phone, message);
}

// ── Payment Reminder ───────────────────────────────────────────────────────
async function sendPaymentReminder(booking) {
  const message =
    `💰 *Payment Pending – SolarSeva*\n\n` +
    `Hi ${booking.name},\n\n` +
    `Your booking *${booking.bookingId}* payment is still pending.\n\n` +
    `Amount: ₹${booking.amount}\n\n` +
    `Complete payment here or contact us at *+91 98765 43210*`;

  await sendTextMessage(booking.phone, message);
}

// ── Service Completion ─────────────────────────────────────────────────────
async function sendServiceCompleted(booking) {
  const message =
    `✅ *Service Completed – SolarSeva*\n\n` +
    `Hello ${booking.name},\n\n` +
    `Your solar panel service is complete! 🌞\n\n` +
    `Booking: ${booking.bookingId}\n\n` +
    `Please rate your experience (1-5):\n` +
    `Reply: *RATE ${booking.bookingId} 5*\n\n` +
    `Thank you for choosing SolarSeva! ⚡`;

  await sendTextMessage(booking.phone, message);
}

module.exports = {
  sendTextMessage,
  sendBookingConfirmation,
  sendTechnicianAssigned,
  sendPaymentReminder,
  sendServiceCompleted,
};
