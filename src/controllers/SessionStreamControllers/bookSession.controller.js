import { Op } from "sequelize";
import { User } from "../../Models/UserModels/UserModel.js";
import { Session } from "../../Models/SessionModel.js";
import { BookedSession } from "../../Models/BookedSession.js";
import { CatalogueNode } from "../../Models/CatalogModels/catalogueNode.model.js";
import { Teachertopicstats } from "../../Models/TeachertopicstatsModel.js";

/* ============================================================================
   Utilities
   ============================================================================ */
function zonedTimeToUtc(date) {
  return new Date(date);
}

function calculateMismatchPercentage(learnerLangs = [], teacherLangs = []) {
  const matches = teacherLangs.filter((l) => learnerLangs.includes(l)).length;
  const total = new Set([...learnerLangs, ...teacherLangs]).size || 1;
  const mismatch = total - matches;
  return (mismatch / total) * 100;
}

function getDistance(a, b) {
  if (!a || !b) return 0;
  const { lat: lat1, lon: lon1 } = a;
  const { lat: lat2, lon: lon2 } = b;
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;

  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const A =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(A), Math.sqrt(1 - A));
  return R * c;
}

function scoreTeacher(learner, teacher, mismatchPercent, distanceKm) {
  let score = 0;
  const genderPoints = learner.gender === "female" ? 10 : 5;
  if (learner.gender && teacher.gender && learner.gender === teacher.gender) score += genderPoints;
  score -= mismatchPercent;
  score += distanceKm / 10;
  return score;
}

/** Topic → subject → domain, then read metadata.paid_min_rating (default 4) */
async function getDomainMinRating(topicId) {
  const topic = await CatalogueNode.findByPk(topicId, { attributes: ["parent_id"] });
  if (!topic?.parent_id) return 4;

  const subject = await CatalogueNode.findByPk(topic.parent_id, { attributes: ["parent_id"] });
  if (!subject?.parent_id) return 4;

  const domain = await CatalogueNode.findByPk(subject.parent_id, {
    attributes: ["metadata"],
  });

  const v = Number(domain?.metadata?.paid_min_rating);
  return Number.isFinite(v) && v > 0 ? v : 4;
}

/** ORM-safe: fetch teacherIds eligible for topic by tier/rating */
async function getEligibleTeacherIds(topicId, tier, minRating = 4) {
  const where = { node_id: topicId };
  if (tier === "free") {
    where.tier = "free";
  } else if (tier === "paid") {
    where.tier = "paid";
    where.rating = { [Op.gte]: minRating };
  } else {
    return [];
  }
  const rows = await Teachertopicstats.findAll({ where, attributes: ["teacherId"], raw: true });
  return rows.map((r) => r.teacherId);
}

/* ============================================================================
   Discovery (listing) endpoints — hard filters on BOTH teacher stats & session row
   ============================================================================ */

/** GET /api/session/list/free?topicId=... */
export const listFreeSessions = async (req, res) => {
  try {
    const topicId = req.query.topicId;
    if (!topicId) return res.status(400).json({ error: true, message: "topicId is required" });

    const teacherIds = await getEligibleTeacherIds(topicId, "free");
    if (teacherIds.length === 0) return res.status(200).json({ success: true, sessions: [] });

    const sessions = await Session.findAll({
      where: {
        topic_id: topicId,
        status: "available",
        session_tier: "free",              // 🔒 session row must also be FREE
        teacher_id: { [Op.in]: teacherIds },
      },
      attributes: [
        "session_id",
        "teacher_id",
        "topic_id",
        "scheduled_at",
        "duration_minutes",
        "session_tier",
        "session_level",
      ],
      order: [["scheduled_at", "ASC"]],
      raw: true,
    });

    return res.status(200).json({ success: true, sessions });
  } catch (err) {
    console.error("❌ listFreeSessions:", err);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
};

/** GET /api/session/list/paid?topicId=... */
export const listPaidSessions = async (req, res) => {
  try {
    const topicId = req.query.topicId;
    if (!topicId) return res.status(400).json({ error: true, message: "topicId is required" });

    const minRating = await getDomainMinRating(topicId);
    const teacherIds = await getEligibleTeacherIds(topicId, "paid", minRating);
    if (teacherIds.length === 0) {
      return res.status(200).json({ success: true, sessions: [], minRating });
    }

    const sessions = await Session.findAll({
      where: {
        topic_id: topicId,
        status: "available",
        session_tier: "paid",              // 🔒 session row must also be PAID
        teacher_id: { [Op.in]: teacherIds },
      },
      attributes: [
        "session_id",
        "teacher_id",
        "topic_id",
        "scheduled_at",
        "duration_minutes",
        "session_tier",
        "session_level",
      ],
      order: [["scheduled_at", "ASC"]],
      raw: true,
    });

    return res.status(200).json({ success: true, sessions, minRating });
  } catch (err) {
    console.error("❌ listPaidSessions:", err);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
};

/* ============================================================================
   Booking endpoints
   ============================================================================ */

/** POST /api/session/book  — auto-match FREE */
export const bookFreeSession = async (req, res) => {
  try {
    const learner_id = req.user?.id;
    const { topic_id } = req.body;
    if (!learner_id || !topic_id)
      return res.status(400).json({ error: true, message: "learner_id and topic_id are required" });

    const learner = await User.findByPk(learner_id, {
      attributes: ["id", "firstName", "gender", "known_language_ids", "location"],
      raw: true,
    });
    if (!learner) return res.status(404).json({ error: true, message: "Learner not found" });

    const teacherIds = await getEligibleTeacherIds(topic_id, "free");
    if (teacherIds.length === 0)
      return res
        .status(404)
        .json({ error: true, message: "No free-tier teachers available for this topic yet." });

    const candidates = await Session.findAll({
      where: {
        topic_id,
        status: "available",
        session_tier: "free",      // 🔒 double-check on row
        teacher_id: { [Op.in]: teacherIds },
      },
      attributes: ["session_id", "teacher_id", "scheduled_at", "duration_minutes"],
      raw: true,
    });
    if (candidates.length === 0)
      return res.status(404).json({ error: true, message: "No free-tier slots available yet." });

    let best = null;
    let bestScore = -Infinity;
    for (const s of candidates) {
      const teacher = await User.findByPk(s.teacher_id, {
        attributes: ["id", "firstName", "gender", "known_language_ids", "location"],
        raw: true,
      });
      if (!teacher) continue;
      const mismatch = calculateMismatchPercentage(
        learner.known_language_ids,
        teacher.known_language_ids
      );
      const dist = getDistance(learner.location, teacher.location);
      const score = scoreTeacher(learner, teacher, mismatch, dist);
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
    if (!best) return res.status(404).json({ error: true, message: "No suitable free slot found" });

    const now = new Date();
    const minStartUTC = zonedTimeToUtc(new Date(now.getTime() + 30 * 60 * 1000));

    const nextSlot = await Session.findOne({
      where: {
        teacher_id: best.teacher_id,
        topic_id,
        status: "available",
        session_tier: "free",
        scheduled_at: { [Op.gte]: minStartUTC },
      },
      order: [["scheduled_at", "ASC"]],
    });
    if (!nextSlot)
      return res.status(404).json({ error: true, message: "Free-tier slots will be available soon." });

    const topic = await CatalogueNode.findByPk(topic_id, { attributes: ["name"], raw: true });

    await BookedSession.create({
      learner_id,
      teacher_id: nextSlot.teacher_id,
      topic_id,
      topic: topic?.name || "Unknown",
      session_id: nextSlot.session_id,
    });

    await Session.update(
      { student_id: learner_id, status: "upcoming", session_tier: "free" },
      { where: { session_id: nextSlot.session_id } }
    );

    const teacher = await User.findByPk(nextSlot.teacher_id, {
      attributes: ["firstName", "lastName"],
      raw: true,
    });

    return res.status(200).json({
      success: true,
      message: "Free-tier session booked successfully",
      data: {
        sessionId: nextSlot.session_id,
        teacherName: `${teacher?.firstName ?? ""} ${teacher?.lastName ?? ""}`.trim(),
        topicName: topic?.name || "Unknown",
        scheduledAt: new Date(nextSlot.scheduled_at).toLocaleString("en-IN"),
      },
    });
  } catch (err) {
    console.error("❌ bookFreeSession:", err);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
};

/** POST /api/session/book/paid  — book specific PAID session (re-validate gates) */
export const bookPaidSession = async (req, res) => {
  try {
    const learner_id = req.user?.id;
    const { session_id } = req.body;
    if (!learner_id || !session_id)
      return res.status(400).json({ error: true, message: "learner_id and session_id are required" });

    const s = await Session.findOne({
      where: { session_id, status: "available", session_tier: "paid" }, // 🔒 must be PAID on row
      attributes: ["session_id", "teacher_id", "topic_id", "scheduled_at"],
      raw: true,
    });
    if (!s) return res.status(404).json({ error: true, message: "Session not available" });

    const minRating = await getDomainMinRating(s.topic_id);
    const stat = await Teachertopicstats.findOne({
      where: { teacherId: s.teacher_id, node_id: s.topic_id },
      attributes: ["tier", "rating"],
      raw: true,
    });

    if (!stat || stat.tier !== "paid" || (stat.rating ?? 0) < minRating) {
      return res
        .status(403)
        .json({ error: true, message: "This slot is not eligible for paid booking" });
    }

    const topic = await CatalogueNode.findByPk(s.topic_id, { attributes: ["name"], raw: true });

    await BookedSession.create({
      learner_id,
      teacher_id: s.teacher_id,
      topic_id: s.topic_id,
      topic: topic?.name || "Unknown",
      session_id: s.session_id,
    });

    await Session.update(
      { student_id: learner_id, status: "upcoming", session_tier: "paid" },
      { where: { session_id: s.session_id } }
    );

    return res.status(200).json({
      success: true,
      message: "Paid session booked successfully",
      data: {
        sessionId: s.session_id,
        topicName: topic?.name || "Unknown",
        scheduledAt: new Date(s.scheduled_at).toLocaleString("en-IN"),
        minRatingGate: minRating,
      },
    });
  } catch (e) {
    console.error("❌ bookPaidSession:", e);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
};
