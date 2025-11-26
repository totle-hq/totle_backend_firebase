import express from "express";
import {
  getAllFeedback,
  getDomainAveragesFromSummary,
  getLifetimeFeedback,
  getSubjectAveragesFromSummary,
  getTopicAveragesFromSummary,
  postFeedBack
} from "../controllers/feedback.controller.js";

import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", authMiddleware, postFeedBack);
router.get("/", authMiddleware, getAllFeedback);

// ⭐ FIXED: TOKEN REQUIRED ⭐
router.get("/global", authMiddleware, getLifetimeFeedback);

router.get("/domain", authMiddleware, getDomainAveragesFromSummary);
router.get("/subject", authMiddleware, getSubjectAveragesFromSummary);
router.get("/topics", authMiddleware, getTopicAveragesFromSummary);

export default router;
