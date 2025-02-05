import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js"; // ✅ Ensure ".js" is included

const router = express.Router();

// ✅ Secure route using Firebase authentication
router.get("/profile", authMiddleware, (req, res) => {
  res.json({
    message: "✅ Authenticated Successfully!",
    user: req.user, // Firebase user info
  });
});

export default router;
