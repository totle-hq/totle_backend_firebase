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

// ✅ ADD THIS IMPORT
import NotificationService from "../../services/notificationService.js";

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

const SESSION_DURATION_MIN = 90;
const BUFFER_MINUTES = 30;
const INCLUDE_BUFFER_IN_TRIM = true; // or false

export const updateAvailabilityAfterBooking = async (session) => {
  const { teacher_id, scheduled_at, completed_at } = session;

  const trimStart = INCLUDE_BUFFER_IN_TRIM
    ? new Date(scheduled_at.getTime() - BUFFER_MINUTES * 60000)
    : scheduled_at;

  const trimEnd = INCLUDE_BUFFER_IN_TRIM
    ? new Date(completed_at.getTime() + BUFFER_MINUTES * 60000)
    : completed_at;

  const dayOfWeek = format(trimStart, "EEEE");
  const dateKey = format(trimStart, "yyyy-MM-dd");

  //1️⃣ Find matching availability
  const availability = await TeacherAvailability.findOne({
    where: {
      teacher_id,
      is_active: true,
      [Op.or]: [
        { is_recurring: true, day_of_week: dayOfWeek },
        { is_recurring: false, available_date: dateKey },
      ],
    },
    order: [["is_recurring", "ASC"]],
  });

  if (!availability) {
    console.warn("⚠️ No availability found for teacher to update.");
    return;
  }

  const [availStartH, availStartM] = availability.start_time.split(":").map(Number);
  const [availEndH, availEndM] = availability.end_time.split(":").map(Number);

  const availStartMin = availStartH * 60 + availStartM;
  const availEndMin = availEndH * 60 + availEndM;

  const slotStartMin = trimStart.getHours() * 60 + trimStart.getMinutes();
  const slotEndMin = trimEnd.getHours() * 60 + trimEnd.getMinutes();

  const toTimeStr = (min) =>
    `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}:00`;

  // 🟢 Scenario 1: Fully consumed
  if (slotStartMin <= availStartMin && slotEndMin >= availEndMin) {
    await TeacherAvailability.update(
      { is_active: false },
      { where: { availability_id: availability.availability_id } }
    );
    return;
  }

  // 🟢 Scenario 2: Booking at start (allowing buffer overlap)
  if (slotStartMin <= availStartMin && slotEndMin < availEndMin) {
    const newStart = toTimeStr(slotEndMin);
    await TeacherAvailability.update(
      { start_time: newStart },
      { where: { availability_id: availability.availability_id } }
    );
    return;
  }

  // 🟢 Scenario 3: Booking at end
  if (slotStartMin > availStartMin && slotEndMin === availEndMin) {
    const newEnd = toTimeStr(slotStartMin);
    await TeacherAvailability.update(
      { end_time: newEnd },
      { where: { availability_id: availability.availability_id } }
    );
    return;
  }

  // 🟢 Scenario 4: Booking in the middle
  if (slotStartMin > availStartMin && slotEndMin < availEndMin) {
    const newEnd = toTimeStr(slotStartMin);
    const newStart = toTimeStr(slotEndMin);

    await TeacherAvailability.update(
      { end_time: newEnd },
      { where: { availability_id: availability.availability_id } }
    );

    await TeacherAvailability.create({
      teacher_id,
      day_of_week: availability.day_of_week,
      start_time: newStart,
      end_time: availability.end_time,
      is_recurring: availability.is_recurring,
      available_date: availability.available_date || null,
      is_active: true,
    });
    return;
  }

  console.warn("❌ Booking doesn't match any known trimming pattern. Skipping update.");
};

/** POST /api/session/book — auto-match FREE */
export const bookFreeSession = async (req, res) => {
  console.log("\n================= 🧩 FreeBook START =================");
  const t0 = Date.now();

  try {
    const learner_id = req.user?.id;
    const { topic_id } = req.body;

    if (!learner_id || !topic_id) {
      return res.status(400).json({
        error: true,
        message: "learner_id and topic_id are required",
      });
    }

    const learner = await User.findByPk(learner_id, {
      attributes: ["id", "firstName", "gender", "known_language_ids", "location"],
      raw: true,
    });

    if (!learner) {
      return res.status(404).json({ error: true, message: "Learner not found" });
    }

    const teacherIds = await getEligibleTeacherIds(topic_id, "free", 4, learner_id);
    const filteredTeacherIds = teacherIds.filter((id) => id !== learner_id);

    if (filteredTeacherIds.length === 0) {
      return res.status(404).json({ error: true, message: "No teachers available." });
    }

    const now = new Date();
    const minStart = new Date(now.getTime() + 30 * 60000);

    const availabilities = await TeacherAvailability.findAll({
      where: {
        teacher_id: { [Op.in]: filteredTeacherIds },
        is_active: true,
      },
      raw: true,
    });

    const slotCandidates = [];

    for (const avail of availabilities) {
      const { teacher_id, start_time, end_time, is_recurring, available_date, day_of_week } = avail;

      const daysToCheck = is_recurring ? [...Array(7).keys()] : [0];

      for (const offset of daysToCheck) {
        const dateToCheck = is_recurring ? addDays(now, offset) : new Date(available_date);
        const weekday = format(dateToCheck, "EEEE");
        const dateStr = format(dateToCheck, "yyyy-MM-dd");

        if (is_recurring && weekday !== day_of_week) continue;

        let availStart = parseIST(dateStr, start_time);
        let availEnd = parseIST(dateStr, end_time);

        if (availEnd <= availStart) availEnd.setDate(availEnd.getDate() + 1);

        if (availEnd <= minStart) continue;

        // Try every 15 minutes within the availability window
        for (
          let slotStart = new Date(Math.max(availStart.getTime(), minStart.getTime()));
          slotStart.getTime() + SESSION_DURATION_MIN * 60000 <= availEnd.getTime();
          slotStart = new Date(slotStart.getTime() + 15 * 60000)
        ) {
          const slotEnd = new Date(slotStart.getTime() + SESSION_DURATION_MIN * 60000);
          const bufferStart = new Date(slotStart.getTime() - BUFFER_MINUTES * 60000);
          const bufferEnd = new Date(slotEnd.getTime() + BUFFER_MINUTES * 60000);

          const overlappingSession = await Session.findOne({
            where: {
              teacher_id,
              status: { [Op.in]: ["booked", "upcoming"] },
              [Op.or]: [
                { scheduled_at: { [Op.between]: [bufferStart, bufferEnd] } },
                { completed_at: { [Op.between]: [bufferStart, bufferEnd] } },
                {
                  scheduled_at: { [Op.lte]: bufferStart },
                  completed_at: { [Op.gte]: bufferEnd },
                },
              ],
            },
          });

          if (!overlappingSession) {
            slotCandidates.push({
              teacher_id,
              scheduled_at: slotStart,
              completed_at: slotEnd,
              duration_minutes: SESSION_DURATION_MIN,
            });
            break; // Only one valid slot per availability
          }
        }
      }
    }

    if (slotCandidates.length === 0) {
      return res.status(400).json({ error: true, message: "No valid 90-minute slots available." });
    }

    // Score candidates
    const scored = [];
    for (const slot of slotCandidates) {
      const teacher = await User.findByPk(slot.teacher_id, {
        attributes: ["id", "firstName", "gender", "known_language_ids", "location"],
        raw: true,
      });

      const mismatch = calculateMismatchPercentage(
        learner.known_language_ids,
        teacher.known_language_ids
      );
      const dist = getDistance(learner.location, teacher.location);
      const score = scoreTeacher(learner, teacher, mismatch, dist);

      scored.push({ ...slot, score });
    }

    scored.sort((a, b) => b.score - a.score);
    const selected = scored[0];

    const session = await Session.create({
      topic_id,
      teacher_id: selected.teacher_id,
      student_id: learner_id,
      scheduled_at: selected.scheduled_at,
      completed_at: selected.completed_at,
      duration_minutes: selected.duration_minutes,
      session_tier: "free",
      status: "upcoming",
    });

    await updateAvailabilityAfterBooking(session);

    const topic = await CatalogueNode.findByPk(topic_id, {
      attributes: ["name"],
      raw: true,
    });

    const teacher = await User.findByPk(selected.teacher_id, {
      attributes: ["firstName", "lastName"],
      raw: true,
    });

    // ✅ ADD NOTIFICATION CREATION HERE
    console.log('🎯 Creating notifications for session booking...');
    try {
      await NotificationService.createSessionBookingNotification({
        sessionId: session.session_id,
        learnerId: learner_id,
        teacherId: selected.teacher_id,
        topicName: topic?.name || "Unknown",
        scheduledAt: selected.scheduled_at,
        sessionType: 'free'
      });
      console.log('✅ Notifications created successfully!');
    } catch (notificationError) {
      console.error('❌ Failed to create notifications:', notificationError);
      // Don't fail the booking if notifications fail
    }

    return res.status(200).json({
      success: true,
      message: "Free-tier session booked successfully",
      data: {
        sessionId: session.session_id,
        teacherName: `${teacher?.firstName ?? ""} ${teacher?.lastName ?? ""}`.trim(),
        topicName: topic?.name || "Unknown",
        scheduledAt: formatInTz(selected.scheduled_at, (req.userTz || "UTC"), "dd MMM yyyy, HH:mm"),
      },
    });
  } catch (err) {
    console.error("❌ bookFreeSession ERROR:", err);
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