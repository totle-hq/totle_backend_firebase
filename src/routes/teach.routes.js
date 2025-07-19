import express from "express";
import { deleteAvailabilitySlot, getAvailabilityChart, getFeedbackSummary, getMyProgression, getSessionSummary, getUpcomingBookedSessions, offerSlot, reportSession, updateAvailabilitySlot, validateEligibility, validateSessionTime } from "../controllers/teach.contorller.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import { getTeachingProgression } from "../controllers/TeachControllers/progression.controller.js";
import { getMyQualifiedTopics } from "../controllers/teach.contorller.js";
import { getMyTopicsWithStats } from "../controllers/teach.contorller.js";



const router = express.Router();


// ✅ Get Teaching Progression (with Auth)
router.get("/progression", authMiddleware, getTeachingProgression);
router.get("/my-topics", authMiddleware, getMyQualifiedTopics);
router.get("/my-topics-stats", authMiddleware, getMyTopicsWithStats);

router.get("/session/:id/summary", authMiddleware, getSessionSummary);
router.get("/session/:id/validate-time", authMiddleware, validateSessionTime);
router.get("/availibity-chart", authMiddleware, getAvailabilityChart);
router.post("/offer-slot", authMiddleware, offerSlot);
router.put("/:id", authMiddleware, updateAvailabilitySlot);
router.delete("/:id", authMiddleware, deleteAvailabilitySlot);
router.get("/upcomming-sessions", authMiddleware, getUpcomingBookedSessions);
router.post("/validate-eligibility", authMiddleware, validateEligibility);
router.get("/my-progression", authMiddleware, getMyProgression);


router.get("/feedback/teacher/summary", authMiddleware, getFeedbackSummary);

router.post("/report-session", authMiddleware, reportSession);


export default router;