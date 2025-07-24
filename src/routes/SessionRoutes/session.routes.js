import express from "express";
import authMiddleware from "../../middlewares/authMiddleware.js";
import { bookFreeSession } from "../../controllers/SessionStreamControllers/bookSession.controller.js";
import { getFirstUpcomingTeacherSession, getRemainingUpcomingTeacherSessions, getStudentSessions } from "../../controllers/SessionStreamControllers/getMySession.js";
const router = express.Router();

// 📝 Route to directly book a session
router.post("/book", authMiddleware, bookFreeSession);

router.get("/student-session", authMiddleware, getStudentSessions);
router.get("/teacher/first-session", authMiddleware, getFirstUpcomingTeacherSession);
router.get("/teacher/remaining-sessions", authMiddleware, getRemainingUpcomingTeacherSessions);

export default router;