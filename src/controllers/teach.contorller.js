// src/controllers/teach.contorller.js
// -----------------------------------------------------------------------------
// TEACH (Availability & related)
// - Free-hand X→Y availability with min 90 mins
// - Edit keeps/updates topics across the grouped slot window
// - Consistent “≥30 minutes from now” gate
// - getAvailabilityChart returns a REAL Session PK (session_id) for editing
// -----------------------------------------------------------------------------

import { Op, fn, col } from "sequelize";
import { SessionSummaires } from "../Models/SessionsummariesModel.js";
import { Teachertopicstats } from "../Models/TeachertopicstatsModel.js";
import { User } from "../Models/UserModels/UserModel.js";
import { ModerationFlag } from "../Models/moderatonflagsModel.js";
import { Session } from "../Models/SessionModel.js";
import { CatalogueNode } from "../Models/CatalogModels/catalogueNode.model.js";
import { findSubjectAndDomain } from "../utils/getsubject.js";
import { assertTeacherBuffer, calculateMismatchPercentage, getDistance, getEligibleTeacherIds, scoreTeacher } from "../utils/sessionUtils.js";
import TeacherAvailability from "../Models/TeacherAvailability.js";
import { format, addDays, getDay, startOfDay } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

// ⬇️ timezone + range helpers (date-fns-tz v3)
import {
  localToUtc,
  dayRangeUtcFromLocalDate,
  weekRangeUtcFromLocalStartDay,
  formatInTz,
  utcToZoned,
} from "../utils/time.js"; // if you saved as JS, use: "../utils/time.js"

// We pass +05:30 in ISO strings, so a plain Date ctor suffices.
function zonedTimeToUtc(dateString /*, tzIgnored */) {
  return new Date(dateString);
}

/* ------------------------------- Report Session ---------------------------- */

export const reportSession = async (req, res) => {
  try {
    const teacher_id = req.user.id;
    const { sessionId, reportStatus, notes } = req.body;

    if (!sessionId || !reportStatus) {
      return res.status(400).json({ error: "sessionId and reportStatus are required" });
    }

    const session = await Session.findByPk(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.teacher_id !== teacher_id) {
      return res.status(403).json({ error: "Not authorized to report this session" });
    }

    const allowedStatuses = ["completed", "learner-no-show", "incomplete", "interrupted", "technical-issue"];
    if (!allowedStatuses.includes(reportStatus)) {
      return res.status(400).json({ error: "Invalid reportStatus value" });
    }

    session.status = reportStatus === "completed" ? "completed" : "flagged";
    await session.save();

    await ModerationFlag.create({
      sessionId: session.session_id, // store true PK
      reporterId: teacher_id,
      reason: reportStatus,
      notes: notes || null,
      status: "open",
    });

    return res.status(200).json({
      message: "Session report and flag submitted successfully",
      session,
    });
  } catch (err) {
    console.error("Report session error:", err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
};

/* ----------------------------- Offer Availability -------------------------- */
// FREE-HAND X→Y with min 90 mins; at least 30 minutes in the future.

export const setTeacherAvailability = async (req, res) => {
  try {
    const teacher_id = req.user.id;
    const tz = req.userTz || "UTC"; // 👈 user/browser timezone from middleware
    const { topic_ids, date, timeRange } = req.body;

    const user = await User.findByPk(teacher_id);
    if (!user?.location) {
      return res.status(400).json({ message: "Please fill in your location in profile to offer a slot." });
    }

    if (!Array.isArray(topic_ids) || topic_ids.length === 0 || !date || !timeRange || !timeRange.includes("-")) {
      return res.status(400).json({ message: "Missing topic_ids array, date, or timeRange." });
    }

    const [startTimeStr, endTimeStr] = timeRange.split("-").map(s => s.trim());
    // Build LOCAL datetimes in the user's tz, then convert to UTC for storage
    const startLocalISO = `${date}T${startTimeStr}:00.000`;
    const endLocalISO   = `${date}T${endTimeStr}:00.000`;

    // Do midnight-crossing check in LOCAL time
    let startLocal = new Date(startLocalISO);
    let endLocal   = new Date(endLocalISO);
    if (endLocal <= startLocal) endLocal = new Date(endLocal.getTime() + 24 * 60 * 60 * 1000);

    // Convert local → UTC instants for DB
    const scheduled_at = localToUtc(startLocal, tz);
    const completed_at = localToUtc(endLocal, tz);

    const duration_minutes = Math.round((completed_at.getTime() - scheduled_at.getTime()) / 60000);
    if (duration_minutes < 90) {
      return res.status(400).json({ message: "Minimum slot length is 90 minutes." });
    }

    // Gate: ≥ 30 min from now (compare in UTC instants)
    const minStart = new Date(Date.now() + 30 * 60 * 1000);
    if (scheduled_at < minStart) {
      return res.status(400).json({ message: "You can only offer a slot at least 30 minutes from now." });
    }

    // Day-of-week computed in LOCAL tz (for your TeacherAvailability schema)
    const startLocalZoned = utcToZoned(scheduled_at, tz);
    const dayOfWeek = format(startLocalZoned, "EEEE"); // e.g., "Monday"
    const formattedStart = `${String(startLocalZoned.getHours()).padStart(2, "0")}:${String(startLocalZoned.getMinutes()).padStart(2, "0")}:00`;
    const endLocalZoned = utcToZoned(completed_at, tz);
    const formattedEnd = `${String(endLocalZoned.getHours()).padStart(2, "0")}:${String(endLocalZoned.getMinutes()).padStart(2, "0")}:00`;
    const available_date = format(startLocalZoned, "yyyy-MM-dd");

    // ❌ Check for exact duplicate slot (same local weekday + start/end)
    const existing = await TeacherAvailability.findOne({
      where: { teacher_id, day_of_week: dayOfWeek, start_time: formattedStart, end_time: formattedEnd },
    });
    if (existing) {
      return res.status(400).json({ message: "You already have this availability slot configured." });
    }

    // ✅ Create availability row (you store local facets here per your schema)
    const availability = await TeacherAvailability.create({
      teacher_id,
      day_of_week: dayOfWeek,
      start_time: formattedStart,
      end_time: formattedEnd,
      is_recurring: false,
      available_date,
      is_active: true,
    });

    return res.status(201).json({ message: "Availability slot created successfully", availability });
  } catch (err) {
    console.error("Offer slot error:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
};



/* ----------------------------- Availability Chart -------------------------- */
// Returns next 7 days; groups multiple topics under the same time window.
// IMPORTANT: returns the REAL PK (`session_id`) so the frontend can PUT.

export const bookFreeSession = async (req, res) => {
  try {
    const learner_id = req.user?.id;
    const { topic_id } = req.body;

    if (!learner_id || !topic_id) {
      return res.status(400).json({ error: true, message: "learner_id and topic_id are required" });
    }

    const learner = await User.findByPk(learner_id, {
      attributes: ["id", "firstName", "gender", "known_language_ids", "location"],
      raw: true,
    });
    if (!learner) return res.status(404).json({ error: true, message: "Learner not found" });

    const teacherIds = await getEligibleTeacherIds(topic_id, "free");
    const filteredTeacherIds = teacherIds.filter(id => id !== learner_id);
    if (filteredTeacherIds.length === 0)
      return res.status(404).json({ error: true, message: "No free-tier teachers available." });

    const now = new Date();
    const minStart = new Date(now.getTime() + 30 * 60000);

    const candidates = await Session.findAll({
      where: {
        topic_id,
        status: "available",
        session_tier: "free",
        teacher_id: { [Op.in]: filteredTeacherIds },
        scheduled_at: { [Op.gt]: minStart },
      },
      attributes: ["session_id", "teacher_id", "scheduled_at", "duration_minutes"],
      order: [["scheduled_at", "ASC"]],
      raw: true,
    });

    const scored = [];
    for (const s of candidates) {
      const teacher = await User.findByPk(s.teacher_id, {
        attributes: ["id", "firstName", "gender", "known_language_ids", "location"],
        raw: true,
      });
      if (!teacher) continue;

      const mismatch = calculateMismatchPercentage(learner.known_language_ids, teacher.known_language_ids);
      const dist = getDistance(learner.location, teacher.location);
      scored.push({ ...s, score: scoreTeacher(learner, teacher, mismatch, dist) });
    }

    scored.sort((a, b) => b.score - a.score);
    if (scored.length === 0)
      return res.status(404).json({ error: true, message: "No suitable free slot found." });

    let chosen = null;
    for (const s of scored) {
      try {
        const proposedStart = new Date(s.scheduled_at);

        // This will handle all overlapping buffers
        await assertTeacherBuffer({
          teacherId: s.teacher_id,
          startAt: proposedStart,
          durationMinutes: s.duration_minutes,
          level: "Bridger",
          excludeSessionId: s.session_id,
        });

        chosen = {
          teacher_id: s.teacher_id,
          proposedStart,
          proposedEnd: new Date(proposedStart.getTime() + s.duration_minutes * 60000),
          baseId: s.session_id,
        };
        break;
      } catch (e) {
        continue;
      }
    }

    if (!chosen) {
      return res.status(404).json({ error: true, message: "No valid upcoming slot available." });
    }

    const nextSlot = await Session.findOne({ where: { session_id: chosen.baseId } });
    if (!nextSlot) throw new Error("Chosen slot vanished");

    await Session.update(
      {
        student_id: learner_id,
        teacher_id: nextSlot.teacher_id,
        status: "upcoming",
        session_tier: "free",
      },
      { where: { session_id: nextSlot.session_id } }
    );

    const topic = await CatalogueNode.findByPk(topic_id, { attributes: ["name"], raw: true });
    const bookedPayload = {
      learner_id,
      teacher_id: nextSlot.teacher_id,
      topic_id,
      topic: topic?.name || "Unknown",
      session_id: nextSlot.session_id,
      status: "initiated",
    };
    await Session.create(bookedPayload);

    // ✅ Reduce availability
    const scheduledDate = new Date(nextSlot.scheduled_at);
    const sessionStartMin = scheduledDate.getHours() * 60 + scheduledDate.getMinutes();
    const sessionEndMin = sessionStartMin + nextSlot.duration_minutes;

    const dayOfWeek = format(scheduledDate, "EEEE");
    const availability = await TeacherAvailability.findOne({
      where: {
        teacher_id: nextSlot.teacher_id,
        day_of_week: dayOfWeek,
        start_time: { [Op.lte]: `${String(Math.floor(sessionEndMin / 60)).padStart(2, "0")}:${String(sessionEndMin % 60).padStart(2, "0")}` },
        end_time: { [Op.gte]: `${String(Math.floor(sessionStartMin / 60)).padStart(2, "0")}:${String(sessionStartMin % 60).padStart(2, "0")}` },
      },
    });

    if (availability) {
      const [startH, startM] = availability.start_time.split(":").map(Number);
      const [endH, endM] = availability.end_time.split(":").map(Number);
      const availStartMin = startH * 60 + startM;
      const availEndMin = endH * 60 + endM;

      let newStart = availability.start_time;
      let newEnd = availability.end_time;

      if (sessionStartMin <= availStartMin && sessionEndMin < availEndMin) {
        newStart = `${String(Math.floor(sessionEndMin / 60)).padStart(2, "0")}:${String(sessionEndMin % 60).padStart(2, "0")}`;
      } else if (sessionEndMin >= availEndMin && sessionStartMin > availStartMin) {
        newEnd = `${String(Math.floor(sessionStartMin / 60)).padStart(2, "0")}:${String(sessionStartMin % 60).padStart(2, "0")}`;
      } else if (sessionStartMin <= availStartMin && sessionEndMin >= availEndMin) {
        newStart = newEnd; // fully consumed
      }

      if (newStart !== availability.start_time || newEnd !== availability.end_time) {
        await TeacherAvailability.update(
          { start_time: newStart, end_time: newEnd },
          {
            where: {
              teacher_id: nextSlot.teacher_id,
              day_of_week: dayOfWeek,
            },
          }
        );
      }
    }

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
scheduledAt: formatInTz(nextSlot.scheduled_at, (req.userTz || "UTC"), "dd MMM yyyy, HH:mm"),
      },
    });
  } catch (err) {
    console.error("❌ bookFreeSession:", err);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
};


/* ------------------------------- Update Slot ------------------------------- */
// Edits a whole grouped slot window (start/end) and its topics.
// - Correct start/end mapping
// - Min 90 mins
// - ≥ 30 mins from now
// - If topic_ids omitted, keep existing topics for that window

// Day mapping helper
const DAY_INDEX_TO_NAME = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const updateAvailabilitySlot = async (req, res) => {
  try {
    const teacher_id = req.user.id;
    const availabilityId = req.params.id;
    const { date, timeRange } = req.body;

    // Basic input validation
    if (!date || !timeRange || !timeRange.includes("-")) {
      return res.status(400).json({ error: "Missing or invalid date/timeRange" });
    }

    const [startTimeStr, endTimeStr] = timeRange.split("-");
    const start = `${date}T${startTimeStr}:00+05:30`;
    const end = `${date}T${endTimeStr}:00+05:30`;

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (endDate <= startDate) endDate.setDate(endDate.getDate() + 1);

    const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
    if (durationMinutes < 90) {
      return res.status(400).json({ error: "Minimum slot length is 90 minutes." });
    }

    const minStart = new Date(Date.now() + 30 * 60 * 1000);
    if (startDate < minStart) {
      return res.status(400).json({ error: "Slot must be at least 30 minutes from now." });
    }

    const dayIndex = getDay(startDate);
    const dayOfWeek = DAY_INDEX_TO_NAME[dayIndex];

    // ✅ Fetch existing availability
    const existing = await TeacherAvailability.findOne({
      where: {
        availability_id: availabilityId,
        teacher_id,
        day_of_week: dayOfWeek,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: "Availability slot not found or unauthorized" });
    }

    // 🧠 Conflict check: does this new time overlap with any booked/upcoming session?
    const conflictSession = await Session.findOne({
      where: {
        teacher_id,
        status: { [Op.in]: ["booked", "upcoming"] },
        [Op.or]: [
          {
            scheduled_at: { [Op.lt]: endDate },
            completed_at: { [Op.gt]: startDate },
          },
          {
            scheduled_at: { [Op.between]: [startDate, endDate] },
          },
          {
            completed_at: { [Op.between]: [startDate, endDate] },
          },
        ],
      },
    });

    if (conflictSession) {
      return res.status(409).json({
        error: "Conflicts with existing session time",
        conflictSession: {
          scheduled_at: conflictSession.scheduled_at.toISOString(),
          completed_at: conflictSession.completed_at.toISOString(),
        },
      });
    }

    // ✅ Update the availability
    await TeacherAvailability.update(
      {
        start_time: startTimeStr,
        end_time: endTimeStr,
        is_recurring: true,
        day_of_week: dayOfWeek,
        available_date: null, // since it's recurring
      },
      {
        where: {
          availability_id: availabilityId,
          teacher_id,
        },
      }
    );

    return res.status(200).json({ message: "Availability slot updated successfully" });
  } catch (err) {
    console.error("❌ Update availability slot error:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
};

/* -------------------------------- Delete Slot ------------------------------ */
// Deletes the whole grouped window (all topics) at that start/end.

export const deleteAvailabilitySlot = async (req, res) => {
  try {
    const teacher_id = req.user.id;
    const availabilityId = req.params.id;

    const slot = await TeacherAvailability.findOne({
      where: {
        availability_id: availabilityId,
        teacher_id,
      },
    });

    if (!slot) {
      return res.status(404).json({ error: "Slot not found or unauthorized" });
    }

    await TeacherAvailability.destroy({
      where: {
        availability_id: availabilityId,
        teacher_id,
      },
    });

    return res.status(200).json({
      message: "Availability slot deleted successfully",
      deleted_availability_id: availabilityId,
    });
  } catch (err) {
    console.error("Delete availability slot error:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
};

export const getAvailabilityChart = async (req, res) => {
  try {
    const teacher_id = req.user.id;
    const tz = req.userTz || "UTC";

    // compute today in user's tz
    const todayLocal = utcToZoned(new Date(), tz);
    const todayISO = format(todayLocal, "yyyy-MM-dd");

    // full 7-day UTC window starting from local midnight today
    const { utcStart, utcEnd } = weekRangeUtcFromLocalStartDay(todayISO, tz);

    // ✅ Include topics + CatalogueNode names (works even if association missing)
  const availabilities = await TeacherAvailability.findAll({
  where: {
    teacher_id,
    is_active: true,
    createdAt: { [Op.lte]: utcEnd },
  },
  include: [
    {
      model: CatalogueNode,
      as: "topics", // ✅ must match the alias in the association
      attributes: ["node_id", "name"],
      through: { attributes: [] }, // hides join table fields
    },
  ],
  order: [["available_date", "ASC"]],
});

    const result = {};

    for (let i = 0; i < 7; i++) {
      const dayUtc = new Date(utcStart.getTime() + i * 86400000);
      const localDay = utcToZoned(dayUtc, tz);
      const dayKey = format(localDay, "yyyy-MM-dd");
      result[dayKey] = [];
    }

    for (const dayKey of Object.keys(result)) {
      const weekday = format(new Date(`${dayKey}T00:00:00`), "EEEE");

      for (const slot of availabilities) {
        const match =
          (slot.is_recurring && slot.day_of_week === weekday) ||
          (!slot.is_recurring && slot.available_date === dayKey);
        if (!match) continue;

        const startLocal = new Date(`${dayKey}T${slot.start_time}`);
        let endLocal = new Date(`${dayKey}T${slot.end_time}`);
        if (endLocal <= startLocal)
          endLocal = new Date(endLocal.getTime() + 86400000);

        // ✅ Resolve topic data (gracefully handles null)
        const topic_ids = slot.Topic ? [slot.Topic.node_id] : [];
        const topic_names = slot.Topic ? [slot.Topic.name] : [];

        result[dayKey].push({
          id: slot.availability_id,
          start_time: format(startLocal, "HH:mm"),
          end_time: format(endLocal, "HH:mm"),
          available_date: slot.available_date,
          recurring: !!slot.is_recurring,
          topic_ids,
          topic_names,
        });
      }
    }

    return res.status(200).json({ tz, availability: result });
  } catch (err) {
    console.error("Error fetching availability chart:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
};

/* ------------------------------ Session Join Gate -------------------------- */
export const validateSessionTime = async (req, res) => {
  try {
    const { id: sessionId } = req.params;

    const session = await Session.findByPk(sessionId);
    if (!session) {
      return res.status(404).json({ joinAllowed: false, reason: "Session not found" });
    }

    const now = new Date();
    const scheduled = new Date(session.scheduled_at);

    const startWindow = new Date(scheduled.getTime() - 10 * 60000);
    const endWindow = new Date(scheduled.getTime() + 15 * 60000);

    const joinAllowed = now >= startWindow && now <= endWindow;
    const reason = joinAllowed ? "Join allowed within window" : "Join not allowed: Outside valid time window";

    return res.status(200).json({ joinAllowed, reason });
  } catch (err) {
    console.error("Time validation failed:", err);
    return res.status(500).json({ joinAllowed: false, reason: "Internal server error" });
  }
};

/* ------------------------------ Eligibility Check -------------------------- */

export const validateEligibility = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { topicId } = req.body;

    if (!topicId) {
      return res.status(400).json({ error: "Missing topicId" });
    }

    const stat = await Teachertopicstats.findOne({ where: { teacherId, topicId } });
    if (!stat) {
      return res.status(404).json({ eligible: false, reason: "No teacher record found for this topic" });
    }

    const { level, rating, sessionCount } = stat;

    let eligible = false;
    let reason = "Eligibility criteria not met";

    if (["Expert", "Master", "Legend"].includes(level)) {
      eligible = true;
      reason = `Eligible for paid sessions at ${level} level`;
    } else if (level === "Bridger" && rating >= 4.5 && sessionCount >= 20) {
      eligible = true;
      reason = "Eligible based on performance (high rating + session count)";
    }

    return res.status(200).json({ eligible, level, rating, sessionCount, reason });
  } catch (err) {
    console.error("Eligibility validation failed:", err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
};

/* ------------------------------- Session Summary --------------------------- */

export const getSessionSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { id: sessionId } = req.params;

    const summary = await SessionSummaires.findOne({ where: { sessionId } });
    if (!summary) return res.status(404).json({ error: "Summary not found" });

    const isEditable = summary.teacherId === userId && ["Bridger", "Expert", "Master", "Legend"].includes(userRole);

    return res.status(200).json({
      summaryText: summary.summaryText,
      tags: summary.tags,
      submittedAt: summary.submittedAt,
      editable: isEditable,
    });
  } catch (err) {
    console.error("Error fetching session summary:", err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
};

/* --------------------------------- Progression ----------------------------- */

const levelProgression = {
  Bridger: { next: "Expert", sessions: 20, rating: 4.2 },
  Expert: { next: "Master", sessions: 50, rating: 4.5 },
  Master: { next: "Legend", sessions: 100, rating: 4.7 },
  Legend: null,
};

export const getMyProgression = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const stats = await Teachertopicstats.findAll({
      where: { teacherId },
      include: [
        { model: CatalogueNode, as: "Topic", attributes: ["node_id", "name", "parent_id"] },
        { model: User, as: "teacher", attributes: ["id", "location"] },
      ],
    });

    const result = await Promise.all(
      stats.map(async (stat) => {
        const { level, rating, sessionCount } = stat;
        const topicId = stat.Topic?.node_id;
        const topicName = stat.Topic?.name || "Unknown";

        const { subject, domain } = await findSubjectAndDomain(topicId);
        const progression = levelProgression[level];

        if (!progression) {
          return {
            topicId,
            topicName,
            currentlevel: level,
            rating,
            sessionCount,
            nextlevel: null,
            sessionsToNextlevel: 0,
            meetsRatingForNextlevel: null,
            subject,
            domain,
          };
        }

        const sessionsRemaining = Math.max(0, progression.sessions - sessionCount);
       const meetsRating = rating >= progression.rating;

        return {
          topicId,
          topicName,
          currentlevel: level,
          rating,
          sessionCount,
          nextlevel: progression.level,
          sessionsToNextlevel: sessionsRemaining,
          meetsRatingForNextlevel: meetsRating,
          subject,
          domain,
        };
      })
    );

    return res.status(200).json(result);
  } catch (err) {
    console.error("Progression fetch failed:", err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
};

/* -------------------------- Upcoming Booked Sessions ----------------------- */

export const getUpcomingBookedSessions = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const now = new Date();

    const sessions = await Session.findAll({
      where: { teacher_id: teacherId, status: "booked", scheduled_at: { [Op.gt]: now } },
      order: [["scheduled_at", "ASC"]],
    });

    const formatted = [];
    for (const s of sessions) {
      let topicName = "N/A";
      let subject = "N/A";

      if (s.topic_id) {
        const topic = await CatalogueNode.findByPk(s.topic_id, { attributes: ["name"] });
        const result = await findSubjectAndDomain(s.topic_id);
        subject = result.subject || "N/A";
        topicName = topic?.name || "N/A";
      }

      let learner = null;
      if (s.student_id) {
        const student = await User.findByPk(s.student_id, {
          attributes: ["id", "firstName", "lastName", "email"],
        });
        learner = {
          id: student?.id || null,
          name: student ? `${student.firstName} ${student.lastName}` : "Unknown",
          email: student?.email || "Not Available",
        };
      }

      formatted.push({
        session_id: s.session_id, // ✅ true PK
        scheduled_at: s.scheduled_at,
        completed_at: s.completed_at,
        topic_id: s.topic_id,
        topic_name: topicName,
        learner,
        subject,
        status: s.status,
      });
    }

    return res.status(200).json({ sessions: formatted });
  } catch (error) {
    console.error("❌ Error fetching upcoming booked sessions:", error);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
};

/* ------------------------------- Feedback Summary -------------------------- */
// If you use CatalogueNode instead of Topic, adapt accordingly. Count column
// updated to Session.session_id to reflect your PK.

export const getFeedbackSummary = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const feedbackData = await Session.findAll({
      where: { teacher_id: teacherId, feedback_rating: { [Op.not]: null } },
      attributes: [
        "topicId",
        [fn("AVG", col("feedback_rating")), "averageRating"],
        [fn("COUNT", col("Session.session_id")), "sessionCount"], // ✅ use PK column
      ],
      group: ["topic_id"], // adjust includes/groups if you join a Topic/CatalogueNode table
    });

    const result = feedbackData.map((row) => ({
      topicId: row.topicId,
      topicName: row.Topic?.name || "Unknown",
      averageRating: parseFloat(row.get("averageRating")),
      sessionCount: parseInt(row.get("sessionCount")),
    }));

    const totalSessions = result.reduce((acc, r) => acc + r.sessionCount, 0);
    const weightedSum = result.reduce((acc, r) => acc + r.averageRating * r.sessionCount, 0);
    const overallAvg = totalSessions ? weightedSum / totalSessions : 0;

    return res.status(200).json({
      teacherId,
      averageRating: parseFloat(overallAvg.toFixed(2)),
      totalFeedbacks: totalSessions,
      feedbackByTopic: result,
    });
  } catch (err) {
    console.error("Feedback summary error:", err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
};

/* --------------------------- Qualified Topics APIs ------------------------- */

export const getMyQualifiedTopics = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const stats = await Teachertopicstats.findAll({
      where: { teacherId },
      include: [{ model: CatalogueNode, as: "Topic", attributes: ["node_id", "name", "parent_id"] }],
    });

    const topicsMap = {};
    for (const stat of stats) {
      const topic = stat.Topic;
      if (!topic) continue;

      const subjectNode = await CatalogueNode.findByPk(topic.parent_id, {
        attributes: ["node_id", "name", "parent_id"],
      });

      let domainNode = null;
      if (subjectNode?.parent_id) {
        domainNode = await CatalogueNode.findByPk(subjectNode.parent_id, {
          attributes: ["node_id", "name"],
        });
      }

      const domainName = domainNode?.name || "Unknown Domain";
      const subjectName = subjectNode?.name || "Unknown Subject";

      if (!topicsMap[domainName]) topicsMap[domainName] = {};
      if (!topicsMap[domainName][subjectName]) topicsMap[domainName][subjectName] = [];

      topicsMap[domainName][subjectName].push(topic.name);
    }

    return res.status(200).json({ topics: topicsMap });
  } catch (err) {
    console.error("❌ Error fetching qualified topics:", err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
};

export const getMyTopicsWithStats = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const stats = await Teachertopicstats.findAll({
      where: { teacherId },
      include: [
        {
          model: CatalogueNode,
          // as: "Topic",
          attributes: ["node_id", "name", "parent_id"],
        },
      ],
    });

    const topicsWithStats = [];
    for (const stat of stats) {
      const topic = stat.Topic;
      if (!topic) continue;

      const sessions = await Session.findAll({
        where: { teacher_id: teacherId, topic_id: topic.node_id, status: "completed" },
        attributes: ["student_id"],
      });

      const uniqueLearners = new Set();
      sessions.forEach((s) => {
        if (s.student_id) uniqueLearners.add(s.student_id);
      });

      topicsWithStats.push({
        topic_id: topic.node_id,
        topic_name: topic.name,
        sessionCount: sessions.length,
        uniqueLearnerCount: uniqueLearners.size,
      });
    }

    return res.status(200).json({ topics: topicsWithStats });
  } catch (err) {
    console.error("❌ Error fetching topics with stats:", err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
};

/* ---------------------- Admin — Get All Teacher Availabilities ---------------------- */
// ✅ FIXED VERSION — includes script-qualified Bridgers (from Teachertopicstats)

export const getAllTeacherAvailabilities = async (req, res) => {
  try {
    console.log("🔍 AUTH USER:", req.user);
    if (!req.user) {
      return res.status(401).json({ error: "Missing user from token" });
    }

    const now = new Date();

    // 🟢 STEP 1: Fetch all Bridger-level teachers from Teachertopicstats
    const bridgerStats = await Teachertopicstats.findAll({
      where: { level: "Bridger" },
      attributes: ["teacherId"],
      group: ["teacherId"],
      raw: true,
    });

    const bridgerTeacherIds = bridgerStats.map((s) => s.teacherId);

    // 🟢 STEP 2: Fetch available sessions (as before)
    const sessions = await Session.findAll({
      where: { status: "available" },
      include: [
        {
          model: User,
          as: "teacher",
          attributes: ["id", "firstName", "lastName", "location"],
        },
        {
          model: CatalogueNode,
          as: "Topic",
          attributes: ["node_id", "name"],
        },
      ],
      order: [["scheduled_at", "ASC"]],
    });

    // 🟢 STEP 3: Group sessions by teacher
    const grouped = {};
    for (const s of sessions) {
      const teacherId = s.teacher?.id;
      if (!teacherId) continue;

      if (!grouped[teacherId]) {
        grouped[teacherId] = {
          teacherId,
          teacherName: `${s.teacher?.firstName || ""} ${s.teacher?.lastName || ""}`.trim(),
          timezone: s.teacher?.location?.timezone || "Asia/Kolkata",
          slots: { upcoming: [], past: [] },
        };
      }

      const slotObj = {
        sessionId: s.session_id,
        scheduled_at: s.scheduled_at,
        completed_at: s.completed_at,
        topics: [{ id: s.Topic?.node_id, name: s.Topic?.name }],
      };

      const completedTime = new Date(s.completed_at || s.scheduled_at);
      if (completedTime >= now) grouped[teacherId].slots.upcoming.push(slotObj);
      else grouped[teacherId].slots.past.push(slotObj);
    }

    // 🟢 STEP 4: Ensure all Bridger teachers are represented (even if no sessions)
    const bridgerTeachers = await User.findAll({
      where: { id: bridgerTeacherIds },
      attributes: ["id", "firstName", "lastName", "location"],
    });

    for (const t of bridgerTeachers) {
      if (!grouped[t.id]) {
        grouped[t.id] = {
          teacherId: t.id,
          teacherName: `${t.firstName || ""} ${t.lastName || ""}`.trim(),
          timezone: t.location?.timezone || "Asia/Kolkata",
          slots: { upcoming: [], past: [] },
        };
      }
    }

    // 🟢 STEP 5: Return unified result
    return res.status(200).json(Object.values(grouped));
  } catch (err) {
    console.error("getAllTeacherAvailabilities error:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
};

/* -------------------------- Admin — Update Teacher Availability -------------------------- */
// Allows Founder / Superadmin / Helix (Operations) to overwrite any teacher’s slot directly.
// Works like updateAvailabilitySlot but bypasses teacher_id restriction.

export const updateTeacherAvailabilityAdmin = async (req, res) => {
  try {
    const sessionId = req.params.id;
    let { date, timeRange, topic_ids } = req.body;

    if (!date || !timeRange || !timeRange.includes("-")) {
      return res.status(400).json({ error: "Missing or invalid date/timeRange" });
    }

    const reference = await Session.findByPk(sessionId);
    if (!reference || reference.status !== "available") {
      return res.status(404).json({ error: "Slot not found or unavailable" });
    }

    const [startTimeStr, endTimeStr] = timeRange.split("-");
    const startIST = `${date}T${startTimeStr}:00+05:30`;
    const endIST = `${date}T${endTimeStr}:00+05:30`;

    const newScheduledAt = new Date(startIST);
    const newCompletedAt = new Date(endIST);
    if (newCompletedAt <= newScheduledAt) newCompletedAt.setDate(newCompletedAt.getDate() + 1);

    const duration_minutes = Math.round((newCompletedAt - newScheduledAt) / 60000);
    if (duration_minutes < 90) {
      return res.status(400).json({ error: "Minimum slot length is 90 minutes." });
    }

    // Fetch grouped sessions for this window
    const existingSessions = await Session.findAll({
      where: {
        teacher_id: reference.teacher_id,
        status: "available",
        scheduled_at: reference.scheduled_at,
        completed_at: reference.completed_at,
      },
    });

    if (!Array.isArray(topic_ids)) {
      topic_ids = [...new Set(existingSessions.map((s) => s.topic_id))];
    }

    const existingTopicIds = existingSessions.map((s) => s.topic_id);
    const toAdd = topic_ids.filter((id) => !existingTopicIds.includes(id));
    const toKeep = topic_ids.filter((id) => existingTopicIds.includes(id));
    const toRemove = existingTopicIds.filter((id) => !topic_ids.includes(id));

    // Update kept sessions
    for (const s of existingSessions) {
      if (toKeep.includes(s.topic_id)) {
        s.scheduled_at = newScheduledAt;
        s.completed_at = newCompletedAt;
        s.duration_minutes = duration_minutes;
        await s.save();
      }
    }

    // Delete removed topics
    if (toRemove.length) {
      await Session.destroy({
        where: {
          teacher_id: reference.teacher_id,
          status: "available",
          topic_id: toRemove,
          scheduled_at: reference.scheduled_at,
          completed_at: reference.completed_at,
        },
      });
    }

    // Add new topics
    if (toAdd.length) {
      const newRows = toAdd.map((topic_id) => ({
        teacher_id: reference.teacher_id,
        topic_id,
        scheduled_at: newScheduledAt,
        completed_at: newCompletedAt,
        status: "available",
        duration_minutes,
      }));
      await Session.bulkCreate(newRows);
    }

    return res.status(200).json({
      message: "Admin overwrite successful",
      added: toAdd,
      removed: toRemove,
      updated: toKeep,
    });
  } catch (err) {
    console.error("updateTeacherAvailabilityAdmin error:", err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
};
