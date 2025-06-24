import express from "express";
import { addTeacherTopicStat, bookSlot, cancelSlot, getAvailableSlotsForLearners, getFeedbackSummary, getMyProgression, getMyTopics, getSessionSummary, getupcommingsessions, joinSession, offerSlot, reportSession, submitFeedback, submitSessionSummary, validateEligibility, validateSessionTime } from "../controllers/teach.contorller.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router=express.Router();
router.post("/offer-slot",authMiddleware,offerSlot);
router.post("/book-slot", authMiddleware, bookSlot);
router.delete("/cancel-slot",authMiddleware,cancelSlot);
 router.get("/mysessions/upcoming",authMiddleware,getupcommingsessions);
 router.post("/session/:id/summary",authMiddleware,submitSessionSummary);
 router.get("/session/:id/summary",authMiddleware,getSessionSummary);
 router.get("/session/:id/validate-time",authMiddleware,validateSessionTime);
 router.get("/my-topics",authMiddleware,getMyTopics);
router.get("/available-slots",authMiddleware,getAvailableSlotsForLearners);
 router.post("/validate-eligibility",authMiddleware,validateEligibility);
 router.get("/my-progression",authMiddleware,getMyProgression);
//  router.get("/payment-status",authMiddleware,getPaymentEligibilityStatus);
 router.post("/session/:id/feedback",authMiddleware,submitFeedback);
 router.get("/feedback/teacher/summary",authMiddleware,getFeedbackSummary);
 router.get("/session/:id/join",authMiddleware,joinSession);
 router.post("/report-session",authMiddleware,reportSession);
 //Todo: Only for the development purpose
  router.post("/topic",authMiddleware,addTeacherTopicStat);
export default router;