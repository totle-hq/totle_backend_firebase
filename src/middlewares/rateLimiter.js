const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  handler: (req, res) => {
    res.status(429).json({
      error: true,
      message: "Too many login attempts.. Please try again later.",
    });
  },
});

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  handler: (req, res) => {
    res.status(429).json({
      error: true,
      message: "Too many signup attempts.. Please try again later.",
    });
  },
});

module.exports = { loginLimiter, signupLimiter };