// routes/device.route.js

import express from "express";
import { checkDevice } from "../middlewares/checkDevice.js";

const router = express.Router();

// This is a protected route to test if device is allowed
router.post("/verify", checkDevice, (req, res) => {
  res.status(200).json({ success: true, message: "✅ Device is authorized!" });
});

export default router;
