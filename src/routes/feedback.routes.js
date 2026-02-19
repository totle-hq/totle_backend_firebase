import express from "express";
import {
  getAllFeedback,
  getDomainAveragesFromSummary,
  getLifetimeFeedback,
  getSubjectAveragesFromSummary,
  getTopicAveragesFromSummary,
  postFeedBack,
  rebuildTeacherTopicStats
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

router.post("/rebuild-teacher-topic-stats", async (req, res) => {
  try {
    const result = await rebuildTeacherTopicStats();

    return res.status(200).json({
      success: true,
      message: "Teacher topic stats rebuilt successfully",
      ...result,
    });
  } catch (error) {
    console.error("❌ Rebuild failed:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to rebuild teacher topic stats",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
