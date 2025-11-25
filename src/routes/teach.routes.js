// src/routes/teach.routes.js
// -----------------------------------------------------------------------------
// TEACH Routes
// Mount with: app.use("/api/teach", router)
// -----------------------------------------------------------------------------

import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";

// ✅ Import ONLY the exports that actually exist in teach.controller.js
import {
  // Availability core
  getAvailabilityChart,
  setTeacherAvailability,
  updateAvailabilitySlot,
  deleteAvailabilitySlot,

  // Validation / gating
  validateSessionTime,
  validateEligibility,

  // Progression & summaries
  getMyProgression,
  getSessionSummary,
  getUpcomingBookedSessions,
  getFeedbackSummary,

  // Topics
  getMyQualifiedTopics,
  getMyTopicsWithStats,

  // Moderation
  reportSession,
    getAllTeacherAvailabilities,
  updateTeacherAvailabilityAdmin,
  getAllTestsStatisticsOfUser,
  allTeachersList,
  toggleFreeOrPaidTierOfTeacher,
} from "../controllers/teach.controller.js";

// ✅ Get this from its own controller (do NOT import from teach.controller.js)
import { getTeachingProgression } from "../controllers/TeachControllers/progression.controller.js";

const router = express.Router();

/* ------------------------------ Progression ------------------------------ */
router.get("/progression", authMiddleware, getTeachingProgression);
router.get("/my-progression", authMiddleware, getMyProgression);

/* -------------------------------- Topics --------------------------------- */
router.get("/my-topics", authMiddleware, getMyQualifiedTopics);
router.get("/my-topics-stats", authMiddleware, getMyTopicsWithStats);

/* ------------------------------- Sessions -------------------------------- */
router.get("/session/:id/summary", authMiddleware, getSessionSummary);
router.get("/session/:id/validate-time", authMiddleware, validateSessionTime);
router.get("/upcomming-sessions", authMiddleware, getUpcomingBookedSessions);

/* ---------------------------- Availability UI ---------------------------- */
// NOTE: Spelling preserved for backward compatibility: "availibity-chart"
router.get("/availability-chart", authMiddleware, getAvailabilityChart);
router.post("/offer-slot", authMiddleware, setTeacherAvailability);
router.put("/:id", authMiddleware, updateAvailabilitySlot);
router.delete("/:id", authMiddleware, deleteAvailabilitySlot);

/* ------------------------ Eligibility & Moderation ----------------------- */
router.post("/validate-eligibility", authMiddleware, validateEligibility);
router.get("/feedback/teacher/summary", authMiddleware, getFeedbackSummary);
router.post("/report-session", authMiddleware, reportSession);
router.get(
  "/admin/availability/all",
  authMiddleware,
  getAllTeacherAvailabilities
);

// Overwrite / edit specific teacher slot by session_id
router.put(
  "/admin/availability/:id",
  authMiddleware,
  updateTeacherAvailabilityAdmin
);

router.get('/test-stats',authMiddleware, getAllTestsStatisticsOfUser);
router.post("/toggle-tier", authMiddleware, toggleFreeOrPaidTierOfTeacher);
router.get("/list",allTeachersList);
export default router;
