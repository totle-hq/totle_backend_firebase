import { Op } from "sequelize";
import { User } from "../../Models/UserModels/UserModel.js";
import { Session } from "../../Models/SessionModel.js";
import { CatalogueNode } from "../../Models/CatalogModels/catalogueNode.model.js";
import { Teachertopicstats } from "../../Models/TeachertopicstatsModel.js";
import { findAvailableSlot } from "../../services/sessionAvailability.service.js";
import { assertTeacherBuffer } from "../../services/session.service.js";
import TeacherAvailability from "../../Models/TeacherAvailability.js";
import { format, addDays } from "date-fns";
import { sequelize1 } from "../../config/sequelize.js";
import {
  localToUtc,
  dayRangeUtcFromLocalDate,
  weekRangeUtcFromLocalStartDay,
  formatInTz,
  utcToZoned,
} from "../../utils/time.js"; 
import SessionParticipant from "../../Models/SessionParticipant.js";
import { sendSessionBookedEmail } from "../../utils/otpService.js";

// ✅ ADD THIS IMPORT
import NotificationService from "../../services/notificationService.js";
import { transporter } from "../../config/mailer.js";
import dateFnsTz from "date-fns-tz";
import { TeacherAvailabilityTopic } from "../../Models/TeacherAvailabilityTopics.model.js";
const { formatInTimeZone } = dateFnsTz;

/* ============================================================================
   Utilities
   ============================================================================ */
// function zonedTimeToUtc(date) {
//   return new Date(date);
// }

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

/** ORM-safe: fetch teacherIds eligible for topic by tier/rating
 *  Optionally exclude a given userId (for self-booking prevention)
 */
async function getEligibleTeacherIds(topicId, tier, minRating = 4, excludeUserId = null) {
  const where = { node_id: topicId };

  if (tier === "free") {
    where.tier = "free";
  } else if (tier === "paid") {
    where.tier = "paid";
    where.rating = { [Op.gte]: minRating };
  } else {
    return [];
  }

  const rows = await Teachertopicstats.findAll({
    where,
    attributes: ["teacherId"],
    raw: true,
  });

  let teacherIds = rows.map((r) => r.teacherId);

  // ✅ New: Exclude the learner if they are also a teacher for the same topic
  if (excludeUserId && teacherIds.includes(excludeUserId)) {
    teacherIds = teacherIds.filter((id) => id !== excludeUserId);
  }

  return teacherIds;
}

/* ============================================================================
   Discovery (listing) endpoints — hard filters on BOTH teacher stats & session row
   ============================================================================ */

export const listFreeSessions = async (req, res) => {
  try {
    const tz = req.userTz || "UTC";
    const topicId = req.query.topicId;
    if (!topicId) return res.status(400).json({ error: true, message: "topicId is required" });

    const teacherIds = await getEligibleTeacherIds(req.query.topicId, "free", 4, req.user?.id);
    if (teacherIds.length === 0) return res.status(200).json({ success: true, sessions: [] });

    const sessions = await Session.findAll({
      where: {
        topic_id: topicId,
        status: "available",
        session_tier: "free",
        teacher_id: { [Op.in]: teacherIds },
      },
      attributes: ["session_id", "teacher_id", "topic_id", "scheduled_at", "duration_minutes", "session_tier", "session_level"],
      order: [["scheduled_at", "ASC"]],
      raw: true,
    });

    const shaped = sessions.map(s => ({
      ...s,
      // Keep raw UTC
      scheduled_at_utc: s.scheduled_at,
      // Add local strings for the caller's tz
      scheduled_at_local: formatInTz(s.scheduled_at, tz, "yyyy-MM-dd HH:mm"),
    }));

    return res.status(200).json({ success: true, tz, sessions: shaped });
  } catch (err) {
    console.error("❌ listFreeSessions:", err);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
};

export const listPaidSessions = async (req, res) => {
  try {
    const tz = req.userTz || "UTC";
    const topicId = req.query.topicId;
    if (!topicId) return res.status(400).json({ error: true, message: "topicId is required" });

    const minRating = await getDomainMinRating(topicId);
    const teacherIds = await getEligibleTeacherIds(topicId, "paid", minRating, req.user?.id);
    if (teacherIds.length === 0) {
      return res.status(200).json({ success: true, tz, sessions: [], minRating });
    }

    const sessions = await Session.findAll({
      where: {
        topic_id: topicId,
        status: "available",
        session_tier: "paid",
        teacher_id: { [Op.in]: teacherIds },
      },
      attributes: ["session_id", "teacher_id", "topic_id", "scheduled_at", "duration_minutes", "session_tier", "session_level"],
      order: [["scheduled_at", "ASC"]],
      raw: true,
    });

    const shaped = sessions.map(s => ({
      ...s,
      scheduled_at_utc: s.scheduled_at,
      scheduled_at_local: formatInTz(s.scheduled_at, tz, "yyyy-MM-dd HH:mm"),
    }));

    return res.status(200).json({ success: true, tz, sessions: shaped, minRating });
  } catch (err) {
    console.error("❌ listPaidSessions:", err);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
};

const parseIST = (dateStr, timeStr) => {
  const [hour, minute] = timeStr.split(":").map(Number);
  const d = new Date(`${dateStr}T00:00:00Z`); // midnight UTC
  d.setUTCHours(hour - 5, minute - 30); // adjust from IST to UTC
  return d;
};

function getAge(dob) {
  if (!dob) return 0;
  const ageDiff = Date.now() - new Date(dob).getTime();
  return Math.floor(ageDiff / (1000 * 60 * 60 * 24 * 365.25));
}

function getLanguageTier(learner, teacher) {
  const commonKnown = teacher.known_language_ids.filter(lang =>
    learner.known_language_ids.includes(lang)
  );

  const hasCommonPreferred =
    teacher.known_language_ids.includes(learner.preferred_language_id);

  if (!hasCommonPreferred && commonKnown.length >= 2) return 10; // Tier 1
  if (!hasCommonPreferred && commonKnown.length >= 1) return 7; // Tier 2
  if (hasCommonPreferred && commonKnown.length >= 1) return 5; // Tier 3

  return 1; // Disqualify
}

function isWithinBridgerBuffer(slotStart, bridgerSessions) {
  const bufferMs = 30 * 60 * 1000;
  for (const s of bridgerSessions) {
    const sStart = new Date(s.scheduled_at).getTime();
    const sEnd = new Date(s.completed_at).getTime();
    const start = slotStart.getTime();
    if (
      (start >= sStart - bufferMs && start <= sStart + bufferMs) ||
      (start >= sEnd - bufferMs && start <= sEnd + bufferMs)
    ) {
      return true;
    }
  }
  return false;
}


/** POST /api/session/book — auto-match FREE */


const SESSION_DURATION_MIN = 90;
const BUFFER_MINUTES = 30;
const INCLUDE_BUFFER_IN_TRIM = true;

export const updateAvailabilityAfterBooking = async (
  session,
  transaction = null
) => {
  const { teacher_id, scheduled_at, completed_at, session_id } = session;

  const trimStart = INCLUDE_BUFFER_IN_TRIM
    ? new Date(scheduled_at.getTime() - BUFFER_MINUTES * 60000)
    : new Date(scheduled_at);

  const trimEnd = INCLUDE_BUFFER_IN_TRIM
    ? new Date(completed_at.getTime() + BUFFER_MINUTES * 60000)
    : new Date(completed_at);

  // 🔒 Find availability block that fully contains this window
  const availability = await TeacherAvailability.findOne({
    where: {
      teacher_id,
      is_active: true,
      start_at: { [Op.lte]: trimStart },
      end_at: { [Op.gte]: trimEnd },
    },
    lock: transaction?.LOCK?.UPDATE,
    transaction,
  });

  if (!availability) {
    console.warn("⚠️ No matching availability block found for trimming");
    return;
  }

  const availStart = new Date(availability.start_at);
  const availEnd = new Date(availability.end_at);

  const newBlocks = [];

  // 🟥 Fully consumed
  if (trimStart <= availStart && trimEnd >= availEnd) {
    await availability.destroy({ transaction });
    console.log("🟥 Availability fully consumed → removed");
    return;
  }

  // 🟧 Left block remains
  if (trimStart > availStart) {
    newBlocks.push({
      teacher_id,
      start_at: availStart,
      end_at: trimStart,
      is_active: true,
    });
  }

  // 🟦 Right block remains
  if (trimEnd < availEnd) {
    newBlocks.push({
      teacher_id,
      start_at: trimEnd,
      end_at: availEnd,
      is_active: true,
    });
  }

  // Remove original
  await availability.destroy({ transaction });

  // Insert remaining pieces
  for (const block of newBlocks) {
    await TeacherAvailability.create(block, { transaction });
  }

  console.log("✂️ Availability trimmed/split successfully", {
    originalAvailabilityId: availability.availability_id,
    piecesCreated: newBlocks.length,
  });
};

/** POST /api/session/book — auto-match FREE */
export const bookFreeSession = async (req, res) => {
  console.log("\n🔁 Matching Free Session...");
  const transaction = await sequelize1.transaction();

  try {
    const learner_id = req.user?.id;
    const { topic_id,booking_reason } = req.body;

    if (!learner_id || !topic_id) {
      await transaction.rollback();
      return res.status(400).json({ error: true, message: "Missing learner_id or topic_id" });
    }
    // 🔒 Enforce feedback submission before new booking
    const lastCompletedSession = await Session.findOne({
      where: {
        student_id: learner_id,
        status: "completed",
      },
      order: [["completed_at", "DESC"]],
      attributes: ["session_id"],
      transaction,
      lock: transaction.LOCK.SHARE,
      raw: true,
    });

    if (lastCompletedSession) {
      const existingFeedback = await Feedback.findOne({
        where: { session_id: lastCompletedSession.session_id },
        attributes: ["id"],
        transaction,
        raw: true,
      });

      if (!existingFeedback) {
        await transaction.rollback();
        return res.status(403).json({
          error: true,
          message:
            "Please submit feedback for your previous session before booking a new one.",
        });
      }
    }

    const learner = await User.findByPk(learner_id, {
      attributes: [
        "id",
        "gender",
        "dob",
        "known_language_ids",
        "preferred_language_id",
        "latitude",
        "longitude",
      ],
      raw: true,
    });

    if (!learner) {
      await transaction.rollback();
      return res.status(404).json({ error: true, message: "Learner not found" });
    }

    const teacherIds = await getEligibleTeacherIds(topic_id, "free", 4, learner_id);
    if (!teacherIds.length) {
      await transaction.rollback();
      return res.status(404).json({ error: true, message: "No teachers available." });
    }

    const now = new Date();
    const SESSION_DURATION_MIN = 90;
    const BUFFER_MINUTES = 30;
    const MIN_START = new Date(now.getTime() + BUFFER_MINUTES * 60000);
    const MAX_WINDOW = new Date(now.getTime() + 48 * 60 * 60000);

    // 🔎 Fetch availability blocks in next 48 hours
    const availabilityBlocks = await TeacherAvailability.findAll({
      where: {
        teacher_id: { [Op.in]: teacherIds },
        is_active: true,
        end_at: { [Op.gt]: MIN_START },
        start_at: { [Op.lt]: MAX_WINDOW },
      },
      include: [
        {
          model: CatalogueNode,
          as: "topics",
          where: {
            node_id: topic_id,
          },
          through: { attributes: [] }, // remove junction fields from result
          required: true, // IMPORTANT → inner join
        },
      ],
      order: [["start_at", "ASC"]],
      lock: {
        level: transaction.LOCK.UPDATE,
        of: TeacherAvailability,
      },
      skipLocked: true,
      transaction,
    });


    if (!availabilityBlocks.length) {
      await transaction.rollback();
      return res.status(404).json({ error: true, message: "No availability in next 48 hours." });
    }

    // 🔎 Fetch all existing sessions in the 48h window (ONE QUERY)
    const existingSessions = await Session.findAll({
      where: {
        teacher_id: { [Op.in]: teacherIds },
        status: { [Op.in]: ["booked", "upcoming"] },
        scheduled_at: { [Op.lt]: MAX_WINDOW },
        completed_at: { [Op.gt]: MIN_START },
      },
      transaction,
      raw: true,
    });

    const sessionsByTeacher = new Map();

    for (const session of existingSessions) {
      if (!sessionsByTeacher.has(session.teacher_id)) {
        sessionsByTeacher.set(session.teacher_id, []);
      }
      sessionsByTeacher.get(session.teacher_id).push(session);
    }



    const slotCandidates = [];

    const SLOT_STEP_MINUTES = 15; // or 30 if you prefer

    for (const block of availabilityBlocks) {
      const teacher_id = block.teacher_id;

      const blockStart = new Date(Math.max(block.start_at, MIN_START));
      const blockEnd = new Date(block.end_at);

      const teacherSessions = sessionsByTeacher.get(teacher_id) || [];

      // Slide through block
      let currentStart = new Date(blockStart);

      while (
        currentStart.getTime() + SESSION_DURATION_MIN * 60000 <= blockEnd.getTime()
      ) {
        const currentEnd = new Date(
          currentStart.getTime() + SESSION_DURATION_MIN * 60000
        );

        const slotStartWithBuffer = new Date(
          currentStart.getTime() - BUFFER_MINUTES * 60000
        );

        const slotEndWithBuffer = new Date(
          currentEnd.getTime() + BUFFER_MINUTES * 60000
        );

        const overlapping = teacherSessions.some(session => {
          const sessionStart = new Date(session.scheduled_at);
          const sessionEnd = new Date(session.completed_at);

          return (
            sessionStart < slotEndWithBuffer &&
            sessionEnd > slotStartWithBuffer
          );
        });

        if (!overlapping) {
          slotCandidates.push({
            teacher_id,
            scheduled_at: new Date(currentStart),
            completed_at: new Date(currentEnd),
            availabilityBlock: block,
          });

          break; // Stop after first valid slot for this block
        }

        // Move forward by step size
        currentStart = new Date(
          currentStart.getTime() + SLOT_STEP_MINUTES * 60000
        );
      }
    }


    if (!slotCandidates.length) {
      await transaction.rollback();
      return res.status(404).json({ error: true, message: "No suitable slot found." });
    }

    // 🔎 Fetch teachers in bulk (OPTIMIZED)
    const uniqueTeacherIds = [...new Set(slotCandidates.map(s => s.teacher_id))];

    const teachers = await User.findAll({
      where: { id: { [Op.in]: uniqueTeacherIds } },
      attributes: [
        "id",
        "gender",
        "dob",
        "known_language_ids",
        "preferred_language_id",
        "latitude",
        "longitude",
      ],
      raw: true,
    });

    const teacherMap = new Map();
    teachers.forEach(t => teacherMap.set(t.id, t));

    // 🧠 Score teachers
    const scored = [];

    for (const slot of slotCandidates) {
      const teacher = teacherMap.get(slot.teacher_id);
      if (!teacher) continue;

      const langScore = getLanguageTier(learner, teacher);
      console.log("lang score", langScore)
      if (langScore === 0) continue;

      const genderScore = learner.gender === teacher.gender ? 2 : 0;
      console.log("gn", genderScore)

      const distKm = getDistance(
        { lat: learner.latitude, lon: learner.longitude },
        { lat: teacher.latitude, lon: teacher.longitude }
      );

      const distanceScore = Math.max(0, 10 - distKm / 50); // better scaling
      console.log("ds", distanceScore)
      const ageScore = Math.max(0, 5 - Math.abs(getAge(teacher.dob) - getAge(learner.dob)) / 5);
      console.log("as", ageScore)

      const totalScore = langScore * 2 + genderScore + distanceScore + ageScore;
      console.log("ts", totalScore)
      
      scored.push({ ...slot, score: totalScore });
    }

    if (!scored.length) {
      await transaction.rollback();
      return res.status(404).json({ error: true, message: "No suitable teacher found." });
    }

    scored.sort((a, b) => b.score - a.score);
    const selected = scored[0];

    // ✅ Create session
    const session = await Session.create({
      topic_id,
      teacher_id: selected.teacher_id,
      student_id: learner_id,
      scheduled_at: selected.scheduled_at,
      completed_at: selected.completed_at,
      duration_minutes: SESSION_DURATION_MIN,
      session_tier: "free",
      session_level: "Bridger",
      status: "upcoming",
    }, { transaction });

    // 🔥 SPLIT AVAILABILITY BLOCK
    const block = selected.availabilityBlock;

    // 1️⃣ Get existing topic mappings
    const existingTopics = await TeacherAvailabilityTopic.findAll({
      where: { availability_id: block.availability_id },
      transaction,
      raw: true,
    });

    const newBlocks = [];

    if (block.start_at < selected.scheduled_at) {
      newBlocks.push({
        teacher_id: block.teacher_id,
        start_at: block.start_at,
        end_at: selected.scheduled_at,
        is_active: true,
      });
    }

    if (block.end_at > selected.completed_at) {
      newBlocks.push({
        teacher_id: block.teacher_id,
        start_at: selected.completed_at,
        end_at: block.end_at,
        is_active: true,
      });
    }

    // 2️⃣ Delete original block (topics auto-delete if CASCADE is set)
    await block.destroy({ transaction });

    // 3️⃣ Create new blocks + reattach topics
    for (const nb of newBlocks) {
      const createdBlock = await TeacherAvailability.create(nb, { transaction });

      for (const topic of existingTopics) {
        await TeacherAvailabilityTopic.create(
          {
            availability_id: createdBlock.availability_id,
            topic_id: topic.topic_id,
          },
          { transaction }
        );
      }
    }


    // ✅ Fetch full learner, teacher & topic (NEED EMAILS)
    const [teacherFull, learnerFull, topic] = await Promise.all([
      User.findByPk(selected.teacher_id, {
        attributes: ["id", "firstName", "lastName", "email", "profileTimezone"],
        transaction,
        raw: true,
      }),
      User.findByPk(learner_id, {
        attributes: ["id", "firstName", "lastName", "email", "profileTimezone"],
        transaction,
        raw: true,
      }),
      CatalogueNode.findByPk(topic_id, {
        attributes: ["name"],
        transaction,
        raw: true,
      }),
    ]);

    await transaction.commit();

   

    // ✅ Send emails (DO NOT BREAK BOOKING IF FAILS)
    try {
      await sendSessionBookedEmails({
        learner: learnerFull,
        teacher: teacherFull,
        topicName: topic?.name || "Unknown",
        scheduledAtUtc: selected.scheduled_at,
        durationMinutes: SESSION_DURATION_MIN,
        bookingReason: booking_reason?.trim() || null,
      });

      console.log("📧 Session booking emails sent");
    } catch (emailErr) {
      console.error("❌ Email sending failed (booking still successful):", emailErr);
    }

    // ✅ Create Notifications (DO NOT BREAK BOOKING)
    try {
      await NotificationService.createSessionBookingNotification({
        sessionId: session.session_id,
        learnerId: learner_id,
        teacherId: selected.teacher_id,
        topicName: topic?.name || "Unknown",
        scheduledAt: selected.scheduled_at,
        sessionType: "free",
      });

      console.log("🔔 Session booking notifications created");
    } catch (notifErr) {
      console.error("❌ Notification failed (booking still success):", notifErr);
    }

    return res.status(200).json({
      success: true,
      message: "Free-tier session booked successfully",
      data: {
        sessionId: session.session_id,
        scheduledAt: selected.scheduled_at,
        teacherName: `${teacherFull?.firstName ?? ""} ${teacherFull?.lastName ?? ""}`.trim(),
        topicName: topic?.name || "Unknown",
      },
    });

  } catch (err) {
    await transaction.rollback();
    console.error("❌ bookFreeSession ERROR:", err);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
};

const normalizeTimezone = (tz) => {
  if (!tz) return "UTC";

  if (tz === "Asia/Calcutta") return "Asia/Kolkata";

  return tz;
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

    const bookedPayload = {
      learner_id,
      teacher_id: s.teacher_id,
      topic_id: s.topic_id,
      topic: topic?.name || "Unknown",
      session_id: s.session_id,
    };
    if (Session.rawAttributes.status) {
      bookedPayload.status = "initiated";
    }
    await Session.create(bookedPayload);

    await Session.update(
      {
        student_id: learner_id,
        teacher_id: s.teacher_id,
        status: "upcoming",
        session_tier: "paid",
      },
      { where: { session_id: s.session_id } }
    );

    // ✅ ADD NOTIFICATION CREATION FOR PAID SESSION
    console.log('🎯 Creating notifications for paid session booking...');
    try {
      await NotificationService.createSessionBookingNotification({
        sessionId: s.session_id,
        learnerId: learner_id,
        teacherId: s.teacher_id,
        topicName: topic?.name || "Unknown",
        scheduledAt: s.scheduled_at,
        sessionType: 'paid'
      });
      console.log('✅ Notifications created successfully!');
    } catch (notificationError) {
      console.error('❌ Failed to create notifications:', notificationError);
      // Don't fail the booking if notifications fail
    }

    const [teacher, learner] = await Promise.all([
      User.findByPk(s.teacher_id, {
        attributes: ["firstName", "lastName", "email"],
        raw: true,
      }),
      User.findByPk(learner_id, {
        attributes: ["firstName", "lastName", "email"],
        raw: true,
      }),
    ]);

    try {
      await sendSessionBookedEmails({
        learner,
        teacher,
        topicName: topic?.name || "Unknown",
        scheduledAtFormatted: formatInTz(
          s.scheduled_at,
          req.userTz || "UTC",
          "dd MMM yyyy, HH:mm"
        ),
        durationMinutes: 90, // paid sessions are also 90 mins here
      });

      console.log("📧 Paid session booking emails sent");
    } catch (emailError) {
      console.error("❌ Failed to send paid session booking emails:", emailError);
      // Do NOT fail booking if email fails
    }



    return res.status(200).json({
      success: true,
      message: "Paid session booked successfully",
      data: {
        sessionId: s.session_id,
        topicName: topic?.name || "Unknown",
        scheduledAt: formatInTz(s.scheduled_at, (req.userTz || "UTC"), "dd MMM yyyy, HH:mm"),
        minRatingGate: minRating,
      },
    });
  } catch (e) {
    console.error("❌ bookPaidSession:", e);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
};

export const sessionBookedEmail = ({
  recipientName,
  role, // "learner" | "teacher"
  topicName,
  scheduledAt,
  durationMinutes,
  otherPartyName,
  bookingReason
}) => {
  const roleLine =
    role === "teacher"
      ? `You have a new learner booked for your free session.`
      : `Your free learning session has been successfully booked.`;

   const reasonHtml = bookingReason
    ? `<li><strong>Reason:</strong> ${bookingReason}</li>`
    : "";

  const reasonText = bookingReason
    ? `\n- Reason: ${bookingReason}`
    : "";

  return {
    subject: `📘 Free Session Booked – ${topicName}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Hello ${recipientName},</h2>

        <p>${roleLine}</p>

        <h3>📅 Session Details</h3>
        <ul>
          <li><strong>Topic:</strong> ${topicName}</li>
          <li><strong>Date & Time:</strong> ${scheduledAt}</li>
          <li><strong>Duration:</strong> ${durationMinutes} minutes</li>
          <li><strong>${role === "teacher" ? "Learner" : "Teacher"}:</strong> ${otherPartyName}</li>
          ${reasonHtml}
        </ul>

        <p>Please make sure you are available on time.</p>

        <p>Best regards,<br/>
        <strong>TOTLE Team</strong></p>
      </div>
    `,
    text: `
Hello ${recipientName},

${roleLine}

Session Details:
- Topic: ${topicName}
- Date & Time: ${scheduledAt}
- Duration: ${durationMinutes} minutes
- ${role === "teacher" ? "Learner" : "Teacher"}: ${otherPartyName}${reasonText}

Regards,
TOTLE Team
    `,
  };
};


export const sendSessionBookedEmails = async ({
  learner,
  teacher,
  topicName,
  scheduledAtUtc,
  durationMinutes,
  bookingReason
}) => {
  console.log("📧 [Email] Preparing session booking emails", {
    topicName,
    scheduledAtUtc,
    learnerId: learner?.id,
    teacherId: teacher?.id,
  });

  try {
    
    const learnerTz = normalizeTimezone(learner.profileTimezone);
    const teacherTz = normalizeTimezone(teacher.profileTimezone);

    const learnerTime = formatInTimeZone(
      scheduledAtUtc,
      learnerTz,
      "dd MMM yyyy, hh:mm a (zzz)"
    );

    const teacherTime = formatInTimeZone(
      scheduledAtUtc,
      teacherTz,
      "dd MMM yyyy, hh:mm a (zzz)"
    );

    const learnerEmail = sessionBookedEmail({
      recipientName: learner.firstName,
      role: "learner",
      topicName,
      scheduledAt: learnerTime,
      durationMinutes,
      otherPartyName: `${teacher.firstName} ${teacher.lastName ?? ""}`.trim(),
      bookingReason
    });

    const teacherEmail = sessionBookedEmail({
      recipientName: teacher.firstName,
      role: "teacher",
      topicName,
      scheduledAt: teacherTime,
      durationMinutes,
      otherPartyName: `${learner.firstName} ${learner.lastName ?? ""}`.trim(),
      bookingReason
    });

    console.log("📤 [Email] Sending emails", {
      learnerEmail: learner.email,
      teacherEmail: teacher.email,
    });

    const results = await Promise.all([
      transporter.sendMail({
        from: `"TOTLE" <${process.env.EMAIL_USER}>`,
        to: learner.email,
        subject: learnerEmail.subject,
        html: learnerEmail.html,
        text: learnerEmail.text,
      }),
      transporter.sendMail({
        from: `"TOTLE" <${process.env.EMAIL_USER}>`,
        to: teacher.email,
        subject: teacherEmail.subject,
        html: teacherEmail.html,
        text: teacherEmail.text,
      }),
    ]);

    console.log("✅ [Email] Session booking emails sent successfully", {
      learnerMessageId: results[0]?.messageId,
      teacherMessageId: results[1]?.messageId,
    });

    return true;
  } catch (error) {
    console.error("❌ [Email] Failed to send session booking emails", {
      error: error.message,
      stack: error.stack,
      learnerEmail: learner?.email,
      teacherEmail: teacher?.email,
    });

    throw error; // caller decides whether to swallow or handle
  }
};



/** POST /api/session/book/custom
 *  Allows a learner to choose any 90-minute window inside a teacher's available slot.
 */
export const bookCustomSlot = async (req, res) => {
  try {
    const learner_id = req.user?.id;
    const { topic_id, teacher_id, start_time } = req.body;

    if (!learner_id || !topic_id || !teacher_id || !start_time)
      return res.status(400).json({ error: true, message: "Missing required fields" });

    // 1️⃣ Verify teacher slot exists and is available
    const start = new Date(start_time);
    const end = new Date(start.getTime() + 90 * 60000); // 90-min window

    const slot = await Session.findOne({
      where: {
        teacher_id,
        topic_id,
        status: "available",
        scheduled_at: { [Op.lte]: start },
        completed_at: { [Op.gte]: end },
      },
    });

    if (!slot)
      return res.status(404).json({
        error: true,
        message: "No available slot covering that 90-minute window.",
      });

    // 2️⃣ Prevent overlapping bookings for learner
    const conflict = await Session.findOne({
      where: {
        student_id: learner_id,
        status: { [Op.in]: ["booked", "upcoming"] },
        [Op.or]: [
          { scheduled_at: { [Op.between]: [start, end] } },
          { completed_at: { [Op.between]: [start, end] } },
        ],
      },
    });
    if (conflict)
      return res.status(409).json({ error: true, message: "You already have a session in this time window." });

    // 3️⃣ Create a derived session for this learner
    const booked = await Session.create({
      teacher_id,
      student_id: learner_id,
      topic_id,
      scheduled_at: start,
      completed_at: end,
      duration_minutes: 90,
      status: "upcoming",
      session_tier: "free", // can extend later
      session_level: slot.session_level || "Bridger",
    });

    // ✅ ADD NOTIFICATION CREATION FOR CUSTOM SLOT
    console.log('🎯 Creating notifications for custom slot booking...');
    try {
      const topic = await CatalogueNode.findByPk(topic_id, {
        attributes: ["name"],
        raw: true,
      });
      
      await NotificationService.createSessionBookingNotification({
        sessionId: booked.session_id,
        learnerId: learner_id,
        teacherId: teacher_id,
        topicName: topic?.name || "Unknown",
        scheduledAt: start,
        sessionType: 'free'
      });
      console.log('✅ Notifications created successfully!');
    } catch (notificationError) {
      console.error('❌ Failed to create notifications:', notificationError);
      // Don't fail the booking if notifications fail
    }

    const [topic, teacher, learner] = await Promise.all([
      CatalogueNode.findByPk(topic_id, {
        attributes: ["name"],
        raw: true,
      }),
      User.findByPk(teacher_id, {
        attributes: ["firstName", "lastName", "email"],
        raw: true,
      }),
      User.findByPk(learner_id, {
        attributes: ["firstName", "lastName", "email"],
        raw: true,
      }),
    ]);

    try {
      await sendSessionBookedEmails({
        learner,
        teacher,
        topicName: topic?.name || "Unknown",
        scheduledAtUtc: selected.scheduled_at, // ✅ THIS IS THE FIX
        durationMinutes: 90,
      });

      console.log("📧 Custom slot booking emails sent");
    } catch (emailError) {
      console.error("❌ Failed to send custom slot booking emails:", emailError);
      // Do NOT fail booking if email fails
    }

    return res.status(201).json({
      success: true,
      message: "Custom 90-minute session booked successfully.",
      data: {
        sessionId: booked.session_id,
        scheduledAt: booked.scheduled_at,
        completedAt: booked.completed_at,
      },
    });
  } catch (err) {
    console.error("❌ bookCustomSlot:", err);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
};
/* ============================================================================
   GET /api/session/teacher/upcoming-sessions
   Returns ALL upcoming sessions for CURRENT teacher
============================================================================ */
export const getTeacherUpcomingSessions = async (req, res) => {
  try {
    const teacherId = req.user?.id;
    const userTz = req.headers["x-user-timezone"] || "UTC";

    if (!teacherId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: No user found in token",
      });
    }

    // 1️⃣ Fetch teacher’s upcoming sessions
    const sessions = await Session.findAll({
      where: {
        teacher_id: teacherId,
        status: { [Op.in]: ["upcoming", "booked"] },
      },
      attributes: [
        "session_id",
        "student_id",
        "topic_id",
        "scheduled_at",
        "duration_minutes",
      ],
      order: [["scheduled_at", "ASC"]],
      raw: true,
    });

    console.log("sessions length",sessions.length)
    if (!sessions.length) {
      res.set("Cache-Control", "no-store");
      return res.status(200).json({
        success: true,
        sessions: [],
      });
    }

    // 2️⃣ Fetch related students + topics in bulk
    const studentIds = [...new Set(sessions.map(s => s.student_id))];
    const topicIds = [...new Set(sessions.map(s => s.topic_id))];

    const students = await User.findAll({
      where: { id: { [Op.in]: studentIds } },
      attributes: ["id", "firstName", "lastName"],
      raw: true,
    });

    const topics = await CatalogueNode.findAll({
      where: { id: { [Op.in]: topicIds } },
      attributes: ["id", "name", "metadata"],
      raw: true,
    });

    const studentMap = Object.fromEntries(
      students.map(s => [
        s.id,
        `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim(),
      ])
    );

    const topicMap = Object.fromEntries(
      topics.map(t => [
        t.id,
        {
          name: t.name,
          subject: t.metadata?.subject_name || "General",
        },
      ])
    );

    // 3️⃣ Shape final response exactly for your frontend
    const shaped = sessions.map(s => ({
      session_id: s.session_id,
      studentName: studentMap[s.student_id] || "Unknown Student",
      topicName: topicMap[s.topic_id]?.name || "Untitled Topic",
      subject: topicMap[s.topic_id]?.subject || "General",
      scheduled_at: s.scheduled_at, // RAW UTC - frontend handles tz
      duration_minutes: s.duration_minutes ?? 90,
    }));

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      success: true,
      sessions: shaped,
    });

  } catch (err) {
    console.error("❌ getTeacherUpcomingSessions ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch upcoming sessions",
    });
  }
};


export const joinSession = async (req, res) => {
  const { sessionId, role } = req.body;
  const userId = req.user?.id;

  if (!sessionId || !role || !userId) {
    console.log("missing: ", sessionId, role, userId)
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  try {
    // Prevent duplicate joins
    const existing = await SessionParticipant.findOne({
      where: {
        session_id: sessionId,
        user_id: userId,
        role,
        joined_at: { [Op.not]: null },
        left_at: null, // Not ended yet
      },
    });

    if (existing) {
      return res.status(200).json({ success: true, message: "Already joined" });
    }

    await SessionParticipant.create({
      session_id: sessionId,
      user_id: userId,
      role,
      joined_at: new Date(),
    });

    res.json({ success: true });
  } catch (err) {
    console.error("❌ joinSession error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const endSession = async (req, res) => {
  const { sessionId, durationSeconds, endedBy } = req.body;
  const userId = req.user?.id;

  if (!sessionId || !durationSeconds || !endedBy || !userId) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  try {
    // 1. Update this user's session participant record
    const participant = await SessionParticipant.findOne({
      where: {
        session_id: sessionId,
        user_id: userId,
        role: endedBy,
        left_at: null, // Only update if not already marked left
      },
    });

    if (!participant) {
      return res.status(404).json({
        success: false,
        message: "Active session participation not found",
      });
    }

    participant.left_at = new Date();
    participant.duration_seconds = durationSeconds;
    await participant.save();

    // 2. Check if all users have left
    const stillActive = await SessionParticipant.count({
      where: {
        session_id: sessionId,
        left_at: null,
      },
    });

    if (stillActive === 0) {
      await Session.update(
        {
          completed_at: new Date(),
          status: "completed",
        },
        {
          where: { session_id: sessionId },
        }
      );
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ endSession error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};