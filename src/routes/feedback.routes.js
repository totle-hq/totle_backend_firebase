import express, { Router } from "express";
import { getAllFeedback , getDomainAveragesFromSummary, getLifetimeFeedback, getSubjectAveragesFromSummary, getTopicAveragesFromSummary, postFeedBack, verifyFeedbackToken } from "../controllers/feedback.controller.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/",verifyFeedbackToken,postFeedBack);
router.get("/",authMiddleware,getAllFeedback);
router.get("/global",getLifetimeFeedback);
router.get("/domain",authMiddleware,getDomainAveragesFromSummary);
router.get("/subject",authMiddleware,getSubjectAveragesFromSummary);
router.get("/topics",authMiddleware,getTopicAveragesFromSummary);

export default router;