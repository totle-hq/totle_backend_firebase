import express from "express";
import { deleteAvailabilitySlot, getAvailabilityChart, getFeedbackSummary, getMyProgression,getSessionSummary, offerSlot, reportSession,  updateAvailabilitySlot,  validateEligibility, validateSessionTime } from "../controllers/teach.contorller.js";
import authMiddleware from "../middlewares/authMiddleware.js";


const router=express.Router();



 router.get("/session/:id/summary",authMiddleware,getSessionSummary);
 router.get("/session/:id/validate-time",authMiddleware,validateSessionTime);
router.get("/availibity-chart",authMiddleware,getAvailabilityChart);
router.post("/offer-slot", authMiddleware, offerSlot);
router.put("/:id", authMiddleware, updateAvailabilitySlot);
router.delete("/:id", authMiddleware, deleteAvailabilitySlot);

 router.post("/validate-eligibility",authMiddleware,validateEligibility);
 router.get("/my-progression",authMiddleware,getMyProgression);
 

 router.get("/feedback/teacher/summary",authMiddleware,getFeedbackSummary);
 
 router.post("/report-session",authMiddleware,reportSession);
 
 
export default router;