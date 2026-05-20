const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Verify JWT token
exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token) return res.status(401).json({ error: "Not authenticated. Please login." });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) return res.status(401).json({ error: "User not found or deactivated." });

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token." });
  }
};

// Role-based access
exports.restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: "Access denied." });
  }
  next();
};
