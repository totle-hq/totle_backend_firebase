// src/controllers/teach.controller.js
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
import {Test} from '../Models/test.model.js';
import {FeedbackSummary} from "../Models/feedbacksummary.js";
import dateFnsTz from "date-fns-tz";
const { formatInTimeZone } = dateFnsTz;

// ⬇️ timezone + range helpers (date-fns-tz v3)
import {
  localToUtc,
  dayRangeUtcFromLocalDate,
  weekRangeUtcFromLocalStartDay,
  formatInTz,
  utcToZoned,
} from "../utils/time.js"; // if you saved as JS, use: "../utils/time.js"
import Feedback from "../Models/feedbackModels.js";

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
    const tz = req.userTz || "UTC";
    const { topic_ids, date, timeRange } = req.body;

    const user = await User.findByPk(teacher_id);
    if (!user?.location) {
      return res.status(400).json({ message: "Please fill in your location in profile to offer a slot." });
    }

    if (!Array.isArray(topic_ids) || topic_ids.length === 0 || !date || !timeRange || !timeRange.includes("-")) {
      return res.status(400).json({ message: "Missing topic_ids array, date, or timeRange." });
    }

    const [startTimeStr, endTimeStr] = timeRange.split("-").map(s => s.trim());

    const startLocalISO = `${date}T${startTimeStr}:00.000`;
    const endLocalISO = `${date}T${endTimeStr}:00.000`;

    let startLocal = new Date(startLocalISO);
    let endLocal = new Date(endLocalISO);
    if (endLocal <= startLocal) endLocal = new Date(endLocal.getTime() + 86400000);

    const scheduled_at = localToUtc(startLocal, tz);
    const completed_at = localToUtc(endLocal, tz);

    const duration_minutes = Math.round((completed_at - scheduled_at) / 60000);
    if (duration_minutes < 90) {
      return res.status(400).json({ message: "Minimum slot length is 90 minutes." });
    }

    const minStart = new Date(Date.now() + 30 * 60 * 1000);
    if (scheduled_at < minStart) {
      return res.status(400).json({ message: "You can only offer a slot at least 30 minutes from now." });
    }

    const startLocalZoned = utcToZoned(scheduled_at, tz);
    const dayOfWeek = format(startLocalZoned, "EEEE");
    const formattedStart = `${String(startLocalZoned.getHours()).padStart(2, "0")}:${String(startLocalZoned.getMinutes()).padStart(2, "0")}:00`;
    const endLocalZoned = utcToZoned(completed_at, tz);
    const formattedEnd = `${String(endLocalZoned.getHours()).padStart(2, "0")}:${String(endLocalZoned.getMinutes()).padStart(2, "0")}:00`;
    const available_date = format(startLocalZoned, "yyyy-MM-dd");

    // Check for duplicate (same teacher, day, time) — independent of topics
    const existing = await TeacherAvailability.findOne({
      where: {
        teacher_id,
        day_of_week: dayOfWeek,
        start_time: formattedStart,
        end_time: formattedEnd,
        available_date,
      },
    });

    if (existing) {
      return res.status(400).json({ message: "You already have this availability slot configured." });
    }

    // ✅ Create slot
    const availability = await TeacherAvailability.create({
      teacher_id,
      day_of_week: dayOfWeek,
      start_time: formattedStart,
      end_time: formattedEnd,
      is_recurring: false,
      available_date,
      is_active: true,
    });

    // ✅ Attach topics via join table
    await availability.addCatalogueNode(topic_ids); // <- This is required for M:N

    return res.status(201).json({
      message: "Availability slot created successfully",
      availability,
    });
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
    // test PILOT 
    if (filteredTeacherIds.length < 1) {
      return res.status(400).json({
        error: true,
        message: "Awesome pick! Our mentors are getting ready — check back soon to grab your free session.",
      });
    }
    // ORIGINAL
    // if (filteredTeacherIds.length < 2) {
    //   return res.status(400).json({
    //     error: true,
    //     message: "Awesome pick! Our mentors are getting ready — check back soon to grab your free session.",
    //   });
    // }
    const now = new Date();
    const minStart = new Date(now.getTime() + 30 * 60000);
    const MIN_DURATION = 90;
    const candidates = await Session.findAll({
      where: {
        topic_id,
        status: "available",
        session_tier: "free",
        teacher_id: { [Op.in]: filteredTeacherIds },
        scheduled_at: { [Op.gt]: minStart },
        duration_minutes: { [Op.gte]: MIN_DURATION },
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
    console.log(availabilityId);

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

    // Compute start of local day
    const todayLocal = utcToZoned(new Date(), tz);
    const todayISO = format(todayLocal, "yyyy-MM-dd");
    const nowLocal = utcToZoned(new Date(), tz);
    const todayKey = format(nowLocal, "yyyy-MM-dd");


    // Get UTC window: start and end of this 7-day period
    const { utcStart, utcEnd } = weekRangeUtcFromLocalStartDay(todayISO, tz);

    // Fetch all availabilities for the teacher during this window
    const availabilities = await TeacherAvailability.findAll({
      where: {
        teacher_id,
        is_active: true,
        createdAt: { [Op.lte]: utcEnd },
      },
      include: [
        {
          model: CatalogueNode,
          as: "catalogueNode", // ✅ Many-to-many
          attributes: ["node_id", "name"],
          through: { attributes: [] },
        },
      ],
      order: [["available_date", "ASC"]],
    });

    // Build empty structure for each day
    const result = {};
    for (let i = 0; i < 7; i++) {
      const dayUtc = new Date(utcStart.getTime() + i * 86400000);
      const localDay = utcToZoned(dayUtc, tz);
      const dayKey = format(localDay, "yyyy-MM-dd");
      result[dayKey] = [];
    }

    // Map availabilities into the correct day slots
    for (const dayKey of Object.keys(result)) {
      const weekday = format(new Date(`${dayKey}T00:00:00`), "EEEE");

      for (const slot of availabilities) {
        const match =
          (slot.is_recurring && slot.day_of_week === weekday) ||
          (!slot.is_recurring && slot.available_date === dayKey);
        if (!match) continue;

        let startLocal = new Date(`${dayKey}T${slot.start_time}`);
        let endLocal = new Date(`${dayKey}T${slot.end_time}`);
        
        // Handle overnight availability
        if (endLocal <= startLocal) {
          endLocal = new Date(endLocal.getTime() + 86400000);
        }

        // ❌ Skip slots fully in the past
        if (endLocal <= nowLocal) continue;

        // ✂️ Trim past portion for today
        if (dayKey === todayKey && startLocal < nowLocal) {
          startLocal = new Date(nowLocal);
        }

        const topic_ids = slot.catalogueNode?.map(t => t.node_id) || [];
        const topic_names = slot.catalogueNode?.map(t => t.name) || [];

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
    console.error("❌ Error fetching availability chart:", err);
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
    { model: CatalogueNode, as: "catalogueNode", attributes: ["node_id", "name", "parent_id"] },
    { model: User, as: "teacher", attributes: ["id", "location"] },
  ],
});

const result = await Promise.all(
  stats.map(async (stat) => {
    const { level, rating, sessionCount } = stat;
    const topicId = stat.catalogueNode?.node_id;
    const topicName = stat.catalogueNode?.name || "Unknown";


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
        "topic_id",
        [fn("AVG", col("feedback_rating")), "averageRating"],
        [fn("COUNT", col("session_id")), "sessionCount"],
      ],
      include: [
        { model: CatalogueNode, as: "catalogueNode", attributes: ["name"] },
      ],
      group: ["topic_id", "catalogueNode.node_id", "catalogueNode.name"],
    });

    const result = feedbackData.map((row) => ({
      topicId: row.topic_id,
      topicName: row.catalogueNode?.name || "Unknown",
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
include: [{ model: CatalogueNode, as: "catalogueNode", attributes: ["node_id", "name", "parent_id"] }],
    });

    const topicsMap = {};
    for (const stat of stats) {
const topic = stat.catalogueNode;
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
          as: "catalogueNode", // ✅ must match association alias
          attributes: ["node_id", "name", "parent_id"],
        },
      ],
    });

    const topicsWithStats = [];
    for (const stat of stats) {
      const topic = stat.catalogueNode; // ✅ changed from stat.Topic
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

/* ---------------------- Admin — Get All Teacher Availabilities ---------------------- */
// ✅ FINAL VERSION — includes Bridger teachers + qualified topics (even without sessions)

export const getAllTeacherAvailabilities = async (req, res) => {
  try {
    console.log("🔍 AUTH USER:", req.user);
    if (!req.user) {
      return res.status(401).json({ error: "Missing user from token" });
    }

    const now = new Date();

    /* ---------------------------------------------------------
       STEP 1: Fetch all Bridger-level teachers and their topics
       --------------------------------------------------------- */
const bridgerStats = await Teachertopicstats.findAll({
  where: { level: "Bridger" },
  include: [
    {
      model: CatalogueNode,
      as: "catalogueNode", // ✅ match actual alias from association
      attributes: ["node_id", "name"],
    },
  ],
});


    const teacherTopicMap = {};
    for (const stat of bridgerStats) {
      const tId = stat.teacherId;
      if (!teacherTopicMap[tId]) teacherTopicMap[tId] = [];
if (stat.catalogueNode) {
  teacherTopicMap[tId].push({
    id: stat.catalogueNode.node_id,
    name: stat.catalogueNode.name,
  });
}

    }

    const bridgerTeacherIds = Object.keys(teacherTopicMap);

    /* ---------------------------------------------------------
       STEP 2: Fetch all available sessions (actual availability)
       --------------------------------------------------------- */
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

    /* ---------------------------------------------------------
       STEP 3: Group sessions per teacher
       --------------------------------------------------------- */
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
          topics: new Map(), // dedupe
        };
      }

      const topicEntry = {
        id: s.Topic?.node_id,
        name: s.Topic?.name,
      };
      if (topicEntry.id) grouped[teacherId].topics.set(topicEntry.id, topicEntry);

      const slotObj = {
        sessionId: s.session_id,
        scheduled_at: s.scheduled_at,
        completed_at: s.completed_at,
        topics: [topicEntry],
      };

      const completedTime = new Date(s.completed_at || s.scheduled_at);
      if (completedTime >= now) grouped[teacherId].slots.upcoming.push(slotObj);
      else grouped[teacherId].slots.past.push(slotObj);
    }

    /* ---------------------------------------------------------
       STEP 4: Merge in script-qualified Bridger teachers + topics
       --------------------------------------------------------- */
    const bridgerTeachers = await User.findAll({
      where: { id: bridgerTeacherIds },
      attributes: ["id", "firstName", "lastName", "location"],
    });

    for (const t of bridgerTeachers) {
      if (!grouped[t.id]) {
        // teacher without sessions
        grouped[t.id] = {
          teacherId: t.id,
          teacherName: `${t.firstName || ""} ${t.lastName || ""}`.trim(),
          timezone: t.location?.timezone || "Asia/Kolkata",
          slots: { upcoming: [], past: [] },
          topics: new Map(),
        };
      }

      const bridgerTopics = teacherTopicMap[t.id] || [];
      for (const topic of bridgerTopics) {
        grouped[t.id].topics.set(topic.id, topic);
      }
    }

    /* ---------------------------------------------------------
       STEP 5: Finalize structure for response
       --------------------------------------------------------- */
    const finalList = Object.values(grouped).map((g) => ({
      teacherId: g.teacherId,
      teacherName: g.teacherName,
      timezone: g.timezone,
      topics: Array.from(g.topics.values()), // convert Map → Array
      slots: g.slots,
    }));

    return res.status(200).json(finalList);
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


export const getAllTestsStatisticsOfUser = async (req, res) => {
  const userId = req.user.id;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    // Fetch all tests by user, with joined topic name
    const userTests = await Test.findAll({
      where: { user_id: userId },
      include: [
        {
          model: CatalogueNode,
          as: 'topicNode',
          attributes: ['name'],
        },
      ],
      order: [['submitted_at', 'DESC']],
    });

    // Map test data with topic name
    const testsWithStatus = userTests.map(test => ({
      testId: test.test_id,
      topic: test.topicNode?.name || test.topic_name || 'Unnamed Topic',
      eligibleForBridger: test.eligible_for_bridger,
      status: test.eligible_for_bridger ? 'passed' : 'failed',
      submittedAt: test.submitted_at,
      score: test.result?.score ?? null,
      coolingPeriod: test.cooling_period,
    }));

    // Fetch teacher topic-level stats (optional)
    const topicStats = await Teachertopicstats.findAll({
      where: { teacherId: userId },
      include: [
        {
          model: CatalogueNode,
          as: 'catalogueNode',
          attributes: ['name', 'metadata'],  // ensure metadata is retrieved
        },
      ],
    });

    const formattedTopicStats = topicStats.map(stat => {
      const requiredRating = stat.catalogueNode?.metadata?.ratingForPaidTier ?? 4;  // default if missing
      return {
        nodeId: stat.node_id,
        topic: stat.catalogueNode?.name || 'Unnamed Topic',
        tier: stat.tier,
        level: stat.level,
        sessionCount: stat.sessionCount,
        rating: stat.rating,
        paidAt: stat.paidAt,
        requiredRatingForPaidTier: requiredRating,
      };
    });

    return res.json({
      success: true,
      tests: testsWithStatus,
      topicStats: formattedTopicStats,
    });

  } catch (error) {
    console.error('Error fetching test statistics:', error);
    return res.status(500).json({ error: 'Failed to fetch test statistics' });
  }
};

export const toggleFreeOrPaidTierOfTeacher = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { tier, topicId } = req.body;

    if (!['free', 'paid'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier. Must be "free" or "paid".' });
    }

    const [record, created] = await Teachertopicstats.findOrCreate({
      where: { teacherId, node_id: topicId },
      defaults: { tier },
    });

    if (tier === 'paid') {
      const topicNode = await CatalogueNode.findByPk(topicId);
      const requiredRating = topicNode?.metadata?.ratingForPaidTier ?? 4;

      if (record.rating < requiredRating) {
        return res.status(403).json({
          error: `Minimum rating of ${requiredRating} required for paid tier.`,
        });
      }
    }

    if (!created && record.tier !== tier) {
      record.tier = tier;
      await record.save(); // will auto-set `paidAt` if necessary
    }

    return res.status(200).json({
      success: true,
      message: `Tier set to "${tier}"`,
      created,
      updated: !created,
      data: record,
    });
  } catch (error) {
    console.error('Error toggling tier:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


export const allTeachersList = async (req, res) => {
  try {
    const sessions = await Session.findAll({
      include: [
        { model: CatalogueNode, as: "catalogueNode", attributes: ["node_id", "name"] },
        { model: User, as: "teacher", attributes: ["id", "firstName", "lastName", "email"] },
        { model: User, as: "student", attributes: ["id", "firstName", "lastName", "email"] }
      ],
      order: [["scheduled_at", "DESC"]],
    });

    const result = sessions.map(session => ({
      id: session.session_id,
      topic: session.catalogueNode?.name || "-",
      teacher: session.teacher
        ? `${session.teacher.firstName} ${session.teacher.lastName || ""}`.trim()
        : "-",
      student: session.student
        ? `${session.student.firstName} ${session.student.lastName || ""}`.trim()
        : "-",
      scheduled: session.scheduled_at,
      status: session.status,
      actions: {
        sessionId: session.session_id,
        canEdit: session.status === "available" || session.status === "upcoming",
        canDelete: session.status !== "completed"
      }
    }));

    res.json({ data: result });
  } catch (err) {
    console.error("SessionTable Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export const getTeacherFeedbackSummary = async (req, res) => {
  try {
    const teacherId = req.user.id;

    if (!teacherId) {
      return res.status(400).json({
        success: false,
        message: "Missing teacher identity",
      });
    }

    // ------------------------------------------------------
    // 1. Pull all topic-level summary data
    // ------------------------------------------------------
    const summaryRows = await FeedbackSummary.findAll({
      where: { teacher_id: teacherId, node_type: "topic" },
      raw: true,
    });

    if (!summaryRows.length) {
      return res.status(200).json({
        success: true,
        data: {
          star_rating: {
            last_ten_sessions: 0,
            lifetime: 0,
          },
          helpfulness_avg: 0,
          clarity_avg: 0,
          confidence_gain: "0%",
          engagement: "0%",
          pace_trend: { fast: 0, normal: 0, slow: 0 },
          text_feedback: [],
        },
      });
    }

    const avg = (key) =>
      summaryRows.reduce((sum, r) => sum + (+r[key] || 0), 0) /
      (summaryRows.length || 1);

    const percent = (key) =>
      Math.round(
        summaryRows.reduce((sum, r) => sum + (+r[key] || 0), 0) /
          (summaryRows.length || 1)
      );

    const paceStats = {
      fast: summaryRows.reduce((s, r) => s + (r.pace_fast || 0), 0),
      normal: summaryRows.reduce((s, r) => s + (r.pace_normal || 0), 0),
      slow: summaryRows.reduce((s, r) => s + (r.pace_slow || 0), 0),
    };

    // ------------------------------------------------------
    // 2. Pull teacher’s text feedback
    // ------------------------------------------------------
    const qualified = await Teachertopicstats.findAll({
      where: { teacherId },
      attributes: ["node_id"],
      raw: true,
    });

    const topicIds = qualified.map((t) => t.node_id);

    const textFeedback = await Feedback.findAll({
      where: {
        bridger_id: teacherId,
        topic_id: { [Op.in]: topicIds },
        text_feedback: { [Op.ne]: null },
      },
      raw: true,
    });

    // ------------------------------------------------------
    // 3. Build domain → subject → topic → feedback hierarchy
    // ------------------------------------------------------
    const outputHierarchy = {};

    for (const fb of textFeedback) {
      const topicNode = await CatalogueNode.findOne({
        where: { node_id: fb.topic_id },
      });
      if (!topicNode) continue;

      let subject = null;
      let domain = null;
      let parent = topicNode;

      while (parent && parent.parent_id) {
        const next = await CatalogueNode.findOne({
          where: { node_id: parent.parent_id },
        });
        if (!next) break;

        if (next.is_subject) subject = next;
        if (next.is_domain) domain = next;

        parent = next;
      }

      const domainName = domain?.name || "Unknown Domain";
      const subjectName = subject?.name || "Unknown Subject";
      const topicName = topicNode.name;

      if (!outputHierarchy[domainName]) outputHierarchy[domainName] = {};
      if (!outputHierarchy[domainName][subjectName])
        outputHierarchy[domainName][subjectName] = {};
      if (!outputHierarchy[domainName][subjectName][topicName])
        outputHierarchy[domainName][subjectName][topicName] = {
          name: topicName,
          date: fb.created_at ? new Date(fb.created_at).toISOString().split("T")[0] : null,
          feedback: [],
        };

      const user = await User.findByPk(fb.learner_id);
      const learnerName = [user?.firstName, user?.lastName]
        .filter(Boolean)
        .join(" ");

      const comment =
        fb.star_rating > 3
          ? "POSITIVE"
          : fb.star_rating === 3
          ? "NEUTRAL"
          : "NEGATIVE";

      outputHierarchy[domainName][subjectName][topicName].feedback.push({
        learner_name: learnerName || "Anonymous",
        text: fb.text_feedback,
        rating: fb.star_rating,
        comment,
      });
    }

    const groupedFeedback = Object.entries(outputHierarchy).map(
      ([domain, subjects]) => ({
        domain,
        subject: Object.entries(subjects).map(([subject, topics]) => ({
          name: subject,
          topic: Object.values(topics),
        })),
      })
    );

    // ------------------------------------------------------
    // FINAL RESPONSE (TeachDashboard format)
    // ------------------------------------------------------
    return res.status(200).json({
      success: true,
      data: {
        star_rating: {
          last_ten_sessions: +avg("avg_star_rating").toFixed(2),
          lifetime: +avg("avg_star_rating").toFixed(2),
        },
        helpfulness_avg: +avg("avg_helpfulness_rating").toFixed(2),
        clarity_avg: +avg("avg_clarity_rating").toFixed(2),
        confidence_gain: `${percent("confidence_gain_percent")}%`,
        engagement: `${percent("engagement_percent")}%`,
        pace_trend: paceStats,
        text_feedback: groupedFeedback,
      },
    });
  } catch (err) {
    console.error("❌ Feedback Summary API ERROR:", err);
    return res.status(500).json({ success: false, message: "SERVER_ERROR" });
  }
};

export const getTeacherEarningsSummary = async (req, res) => {
  try {
    const teacherId = req.user.id;

    // -----------------------------------
    // Fetch completed PAID sessions only
    // -----------------------------------
    const sessions = await Session.findAll({
      where: {
        teacher_id: teacherId,
        status: "completed",
        session_tier: "paid"
      },
      attributes: [
        "session_id",
        "topic_id",
        "student_id",           // FIXED
        "duration_minutes",
        "scheduled_at",
      ],
      raw: true,
    });

    if (!sessions.length) {
      return res.status(200).json({
        success: true,
        totalEarnings: 0,
        uniqueLearners: 0,
        totalHoursTaught: 0,
        monthlyData: [],
      });
    }

    // ------------------------------------------------------
    // Compute payout per session based on session_level tier
    // ------------------------------------------------------
    const PAYOUTS = {
      Bridger: 180,
      Expert: 500,
      Master: 1200,
      Legend: 2500,
    };

    let totalEarnings = 0;
    let totalHours = 0;

    const monthlyMap = {};

    for (const s of sessions) {
      // Fetch teacher stats for this topic
      const stats = await Teachertopicstats.findOne({
        where: { teacherId, node_id: s.topic_id },
        attributes: ["level"],
        raw: true,
      });

      const level = stats?.level || "Bridger";
      const payout = PAYOUTS[level] || PAYOUTS.Bridger;

      totalEarnings += payout;
      totalHours += (s.duration_minutes || 0) / 60;

      const date = new Date(s.scheduled_at);
      const monthKey = date.toLocaleString("en-US", {
        month: "short",
        year: "numeric",
      });

      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = {
          month: monthKey,
          hours: 0,
          payout: 0,
        };
      }

      monthlyMap[monthKey].hours += (s.duration_minutes || 0) / 60;
      monthlyMap[monthKey].payout += payout;
    }

    const uniqueLearners = new Set(sessions.map((s) => s.student_id)).size;

    return res.status(200).json({
      success: true,
      totalEarnings,
      uniqueLearners,
      totalHoursTaught: totalHours,
      monthlyData: Object.values(monthlyMap),
    });
  } catch (err) {
    console.error("❌ Earnings Summary ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "SERVER_ERROR",
    });
  }
};

export const getPeerRankings = async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Fetch all teacher/topic/domain level avg ratings
    const rows = await FeedbackSummary.findAll({
      where: { node_type: ["topic", "domain"] },
      raw: true,
    });

    if (!rows.length) {
      return res.status(200).json({
        success: true,
        topic: [],
        domain: [],
      });
    }

    // -----------------------------
    // Topic rankings
    // -----------------------------
    const topicRows = rows.filter((r) => r.node_type === "topic");

    // Sort highest rating first
    topicRows.sort((a, b) => b.avg_star_rating - a.avg_star_rating);

    const topicRankings = topicRows.map((r, i) => ({
      rank: i + 1,
      teacher_id: r.teacher_id,
      name: r.teacher_id === teacherId ? "You" : `Teacher ${r.teacher_id.slice(0, 4)}`,
      metric: Number(r.avg_star_rating.toFixed(2)),
    }));

    // -----------------------------
    // Domain rankings
    // -----------------------------
    const domainRows = rows.filter((r) => r.node_type === "domain");

    domainRows.sort((a, b) => b.avg_star_rating - a.avg_star_rating);

    const domainRankings = domainRows.map((r, i) => ({
      rank: i + 1,
      teacher_id: r.teacher_id,
      name: r.teacher_id === teacherId ? "You" : `Teacher ${r.teacher_id.slice(0, 4)}`,
      metric: Number(r.avg_star_rating.toFixed(2)),
    }));

    return res.status(200).json({
      success: true,
      topic: topicRankings,
      domain: domainRankings,
    });
  } catch (err) {
    console.error("❌ Peer Rankings ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "SERVER_ERROR",
    });
  }
};


