// src/routes/SessionRoutes/session.routes.js
import express from "express";
import authMiddleware from "../../middlewares/authMiddleware.js";

/* ---------------- Controllers ---------------- */
import { bookFreeSession, endSession, joinSession } from "../../controllers/SessionStreamControllers/bookSession.controller.js";
import {
  getAllUpcomingTeacherSessions,
  getFirstUpcomingStudentSession,
  getFirstUpcomingTeacherSession,
  getStudentSessions,
} from "../../controllers/SessionStreamControllers/getMySession.js";

/* ---------------- Helix Admin Controllers ---------------- */
import { getAllSessions } from "../../controllers/SessionStreamControllers/getAllSessions.controller.js";
import { updateSessionTiming } from "../../controllers/SessionStreamControllers/updateSessionTiming.controller.js";
import { reassignTeacher } from "../../controllers/SessionStreamControllers/reassignTeacher.controller.js";

/* ---------------- Utilities ---------------- */
import { sequelize1 } from "../../config/sequelize.js";
import { CatalogueNode } from "../../Models/CatalogModels/catalogueNode.model.js";
import { QueryTypes } from "sequelize";
import { authenticateAdmin } from "../../middlewares/adminMiddleware.js";

const router = express.Router();

/* ------------------------------------------------------------------ */
/* Utility: Resolve domain’s paid rating gate (default 4)              */
/* Used for filtering Paid-tier sessions by domain-level rating        */
/* ------------------------------------------------------------------ */
async function resolveMinPaidRating(topicId) {
  try {
    const topic = await CatalogueNode.findByPk(topicId, {
      attributes: ["node_id", "parent_id", "is_topic"],
      raw: true,
    });
    if (!topic?.is_topic) return 4;

    const subject = topic.parent_id
      ? await CatalogueNode.findByPk(topic.parent_id, {
          attributes: ["node_id", "parent_id", "is_subject"],
          raw: true,
        })
      : null;

    const domain = subject?.parent_id
      ? await CatalogueNode.findByPk(subject.parent_id, {
          attributes: ["node_id", "is_domain", "metadata"],
          raw: true,
        })
      : null;

    const gate =
      (domain?.metadata &&
        typeof domain.metadata.min_paid_rating === "number" &&
        Number(domain.metadata.min_paid_rating)) ||
      4;

    return Math.max(0, Math.min(5, gate));
  } catch (err) {
    console.error("⚠️ resolveMinPaidRating error:", err);
    return 4;
  }
}

/* ------------------------------------------------------------------ */
/* Paid Sessions list                                                  */
/* GET /api/session/list/paid?topicId=<uuid>                           */
/* Only sessions: status='available'                                   */
/* Only teachers: tier='paid' AND rating >= domain gate                */
/* ------------------------------------------------------------------ */
router.get("/list/paid", authMiddleware, async (req, res) => {
  const topicId = String(req.query.topicId || "").trim();
  if (!topicId) {
    return res
      .status(400)
      .json({ success: false, message: "topicId is required" });
  }

  try {
    const minRating = await resolveMinPaidRating(topicId);

    const rows = await sequelize1.query(
      `
      SELECT
        s.session_id,
        s.teacher_id,
        s.topic_id,
        s.scheduled_at,
        s.duration_minutes
      FROM "user".sessions AS s
      JOIN catalog.teacher_topic_stats AS tts
        ON tts.teacher_id = s.teacher_id
       AND tts.node_id   = s.topic_id
      WHERE
            s.topic_id = :topicId
        AND s.status   = 'available'
        AND tts.tier   = 'paid'
        AND COALESCE(tts.rating, 0) >= :minRating
      ORDER BY s.scheduled_at ASC
      LIMIT 500
      `,
      {
        replacements: { topicId, minRating },
        type: QueryTypes.SELECT,
      }
    );

    return res.status(200).json({
      success: true,
      minRating,
      sessions: rows.map((r) => ({
        session_id: r.session_id,
        teacher_id: r.teacher_id,
        topic_id: r.topic_id,
        scheduled_at: r.scheduled_at,
        duration_minutes: r.duration_minutes,
      })),
    });
  } catch (err) {
    console.error("❌ /api/session/list/paid error:", err?.message || err);
    if (err?.stack) console.error(err.stack);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
});

/* ------------------------------------------------------------------ */
/* Student / Teacher Session APIs                                      */
/* ------------------------------------------------------------------ */
router.post("/book", authMiddleware, bookFreeSession);
router.get("/student-session", authMiddleware, getStudentSessions);
router.get("/student/first-session", authMiddleware, getFirstUpcomingStudentSession);
router.get("/teacher/first-session", authMiddleware, getFirstUpcomingTeacherSession);
router.get("/teacher/upcoming-sessions", authMiddleware, getAllUpcomingTeacherSessions);


/* ------------------------------------------------------------------ */
/* Helix (Operations) Admin APIs                                       */
/* ------------------------------------------------------------------ */
/**
 * GET /api/session/all
 * → Returns all sessions across the system with joined user/topic data.
 *    Used in Nucleus → Helix → SessionControlCenter.
 */
router.get("/all", authMiddleware, getAllSessions);
router.get("/nucleus/all", getAllSessions);

/**
 * POST /api/session/update-timing
 * Body: { sessionId, newTime }
 * → Allows Helix admins to postpone or prepone a session.
 */
router.post("/update-timing", authMiddleware, updateSessionTiming);

/**
 * POST /api/session/reassign-teacher
 * Body: { sessionId, newTeacherId }
 * → Allows Helix admins to reassign a session to another teacher.
 */
router.post("/reassign-teacher", authMiddleware, reassignTeacher);

router.post("/end", endSession);
router.post("/join",authMiddleware, joinSession);

/* ------------------------------------------------------------------ */
export default router;
