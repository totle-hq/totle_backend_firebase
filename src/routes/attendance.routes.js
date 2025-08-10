import express from "express";
import { endSessionAndMarkAttendance } from "../controllers/attendance.controller.js";
import authMiddleware from "../middlewares/authMiddleware.js";
const router = express.Router();
router.post("/leave", authMiddleware, endSessionAndMarkAttendance);

export default router;
