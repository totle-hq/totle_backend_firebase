import express from "express";
import { getWeekBookings } from "../controllers/WeekOverlay.controller.js";
import authMiddleware from "../middlewares/authMiddleware.js";
const router = express.Router();
// here are the router;
router.get('/bookings/week', authMiddleware, getWeekBookings);

export default router;