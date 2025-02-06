import rateLimit from "express-rate-limit";

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  handler: (req, res) => {
    res.status(429).json({
      error: true,
      message: "Too many login attempts.. Please try again later.",
    });
  },
});

export const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  handler: (req, res) => {
    res.status(429).json({
      error: true,
      message: "Too many signup attempts.. Please try again later.",
    });
  },
});
