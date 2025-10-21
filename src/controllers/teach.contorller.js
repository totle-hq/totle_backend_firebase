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

export const offerSlot = async (req, res) => {
  try {
    const teacher_id = req.user.id;
    const { topic_ids, date, timeRange } = req.body;

    const user = await User.findByPk(teacher_id);
    if (!user?.location) {
      return res.status(400).json({ message: "Please fill in your location in profile to offer a slot." });
    }

    if (!Array.isArray(topic_ids) || topic_ids.length === 0 || !date || !timeRange || !timeRange.includes("-")) {
      return res.status(400).json({ message: "Missing topic_ids array, date, or timeRange." });
    }

    const [startTimeStr, endTimeStr] = timeRange.split("-");
    let scheduled_at = new Date(`${date}T${startTimeStr}:00+05:30`);
    let completed_at = new Date(`${date}T${endTimeStr}:00+05:30`);

    // Handle crossing midnight
    if (completed_at <= scheduled_at) completed_at.setDate(completed_at.getDate() + 1);

    const duration_minutes = Math.round((completed_at.getTime() - scheduled_at.getTime()) / 60000);

    // Min 90 minutes rule
    if (duration_minutes < 90) {
      return res.status(400).json({ message: "Minimum slot length is 90 minutes." });
    }

    // At least 30 minutes from now
    const minStart = new Date(Date.now() + 30 * 60 * 1000);
    if (scheduled_at < minStart) {
      return res.status(400).json({ message: "You can only offer a slot at least 30 minutes from now." });
    }

    // Prevent overlapping available slots for this teacher
    const overlapping = await Session.findOne({
      where: {
        teacher_id,
        status: "available",
        scheduled_at: { [Op.lt]: completed_at },
        completed_at: { [Op.gt]: scheduled_at },
      },
    });
    if (overlapping) {
      return res.status(400).json({ message: "You already have an offered slot during this time." });
    }

    const createdSessions = [];
    for (const topic_id of topic_ids) {
      const session = await Session.create({
        teacher_id,
        topic_id,
        scheduled_at,
        completed_at,
        duration_minutes,
        status: "available",
      });
      createdSessions.push(session);
    }

    return res.status(201).json({ message: "Slots offered successfully", sessions: createdSessions });
  } catch (err) {
    console.error("Offer slot error:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
};

/* ----------------------------- Availability Chart -------------------------- */
// Returns next 7 days; groups multiple topics under the same time window.
// IMPORTANT: returns the REAL PK (`session_id`) so the frontend can PUT.

export const getAvailabilityChart = async (req, res) => {
  try {
    const teacher_id = req.user.id;

    const todayIST = new Date();
    const endDateIST = new Date(todayIST);
    endDateIST.setDate(todayIST.getDate() + 7);

    const todayUTC = zonedTimeToUtc(todayIST, "Asia/Kolkata");
    const endDateUTC = zonedTimeToUtc(endDateIST, "Asia/Kolkata");

    const sessions = await Session.findAll({
      where: {
        teacher_id,
        status: "available",
        scheduled_at: { [Op.between]: [todayUTC, endDateUTC] },
      },
      order: [["scheduled_at", "ASC"]],
      raw: true,
    });

    // Build topic map
    const allTopicIds = [...new Set(sessions.map((s) => s.topic_id))];
    const topicRecords = allTopicIds.length
      ? await CatalogueNode.findAll({
          where: { node_id: allTopicIds },
          attributes: ["node_id", "name"],
          raw: true,
        })
      : [];
    const topicMap = {};
    for (const t of topicRecords) topicMap[t.node_id] = t.name;

    // Init availability buckets for 7 days (keys in en-CA)
    const availability = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(todayIST);
      d.setDate(todayIST.getDate() + i);
      const key = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      availability[key] = [];
    }

    // Group by scheduled_at (start time)
    const timeMap = new Map();
    for (const session of sessions) {
      const startIso = new Date(session.scheduled_at).toISOString();
      if (!timeMap.has(startIso)) {
        timeMap.set(startIso, {
          id: session.session_id, // ✅ REAL PK for edit
          scheduled_at: new Date(session.scheduled_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
          completed_at: session.completed_at
            ? new Date(session.completed_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
            : null,
          topic_ids: [],
          topic_names: [],
          status: session.status,
        });
      }
      const entry = timeMap.get(startIso);
      entry.topic_ids.push(session.topic_id);
      entry.topic_names.push(topicMap[session.topic_id] || "Unknown");
    }

    for (const [iso, group] of timeMap.entries()) {
      const key = new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      if (availability[key]) availability[key].push(group);
    }

    return res.status(200).json({ availability });
  } catch (err) {
    console.error("Error fetching availability chart:", err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
};

/* ------------------------------- Update Slot ------------------------------- */
// Edits a whole grouped slot window (start/end) and its topics.
// - Correct start/end mapping
// - Min 90 mins
// - ≥ 30 mins from now
// - If topic_ids omitted, keep existing topics for that window

export const updateAvailabilitySlot = async (req, res) => {
  try {
    const teacher_id = req.user.id;
    const sessionId = req.params.id;
    let { date, timeRange, topic_ids } = req.body;

    const reference = await Session.findByPk(sessionId);
    if (!reference || reference.teacher_id !== teacher_id || reference.status !== "available") {
      return res.status(404).json({ error: "Slot not found or unauthorized" });
    }

    if (!date || !timeRange || !timeRange.includes("-")) {
      return res.status(400).json({ error: "Missing or invalid date/timeRange" });
    }

    const [startTimeStr, endTimeStr] = timeRange.split("-");
    const startIST = `${date}T${startTimeStr}:00+05:30`;
    const endIST = `${date}T${endTimeStr}:00+05:30`;

    // ✅ Correct assignment: start → scheduled_at, end → completed_at
    let newScheduledAt = new Date(startIST);
    let newCompletedAt = new Date(endIST);
    if (newCompletedAt <= newScheduledAt) newCompletedAt.setDate(newCompletedAt.getDate() + 1);

    const duration_minutes = Math.round((newCompletedAt.getTime() - newScheduledAt.getTime()) / 60000);

    // Min 90 minutes
    if (duration_minutes < 90) {
      return res.status(400).json({ error: "Minimum slot length is 90 minutes." });
    }

    // At least 30 minutes from now
    const minStart = new Date(Date.now() + 30 * 60 * 1000);
    if (newScheduledAt < minStart) {
      return res.status(400).json({ error: "Updated slot must start at least 30 minutes from now." });
    }

    // All sessions in the old grouped window
    const existingSessions = await Session.findAll({
      where: {
        teacher_id,
        status: "available",
        scheduled_at: reference.scheduled_at,
        completed_at: reference.completed_at,
      },
    });

    // If topics omitted, keep existing topics
    if (!Array.isArray(topic_ids)) {
      topic_ids = [...new Set(existingSessions.map((s) => s.topic_id))];
    }

    const existingTopicIds = existingSessions.map((s) => s.topic_id);
    const toAdd = topic_ids.filter((id) => !existingTopicIds.includes(id));
    const toKeep = topic_ids.filter((id) => existingTopicIds.includes(id));
    const toRemove = existingTopicIds.filter((id) => !topic_ids.includes(id));

    // Move kept topics
    for (const s of existingSessions) {
      if (toKeep.includes(s.topic_id)) {
        s.scheduled_at = newScheduledAt;
        s.completed_at = newCompletedAt;
        s.duration_minutes = duration_minutes;
        await s.save();
      }
    }

    // Remove dropped topics
    if (toRemove.length) {
      await Session.destroy({
        where: {
          teacher_id,
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
        teacher_id,
        topic_id,
        scheduled_at: newScheduledAt,
        completed_at: newCompletedAt,
        status: "available",
        duration_minutes,
      }));
      await Session.bulkCreate(newRows);
    }

    return res.status(200).json({
      message: "Slot updated successfully for all selected topics",
      added: toAdd,
      removed: toRemove,
      updated: toKeep,
    });
  } catch (err) {
    console.error("Update slot error:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
};

/* -------------------------------- Delete Slot ------------------------------ */
// Deletes the whole grouped window (all topics) at that start/end.

export const deleteAvailabilitySlot = async (req, res) => {
  try {
    const teacher_id = req.user.id;
    const sessionId = req.params.id;

    const session = await Session.findByPk(sessionId);
    if (!session || session.teacher_id !== teacher_id || session.status !== "available") {
      return res.status(404).json({ error: "Slot not found or unauthorized" });
    }

    const { scheduled_at, completed_at } = session;

    const deletedCount = await Session.destroy({
      where: {
        teacher_id,
        status: "available",
        scheduled_at,
        completed_at,
      },
    });

    return res.status(200).json({
      message: "Slot deleted successfully",
      deleted_sessions: deletedCount,
    });
  } catch (err) {
    console.error("Delete slot error:", err);
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

export const getAllTeacherAvailabilities = async (req, res) => {
  try {
    console.log("🔍 AUTH USER:", req.user);
    if (!req.user) {
      return res.status(401).json({ error: "Missing user from token" });
    }

    const now = new Date();

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

    const grouped = {};
    for (const s of sessions) {
      const teacherId = s.teacher?.id;
      if (!grouped[teacherId]) {
        grouped[teacherId] = {
          teacherId,
          teacherName: `${s.teacher?.firstName || ""} ${
            s.teacher?.lastName || ""
          }`.trim(),
          timezone: s.teacher?.location?.timezone || "Asia/Kolkata",
          slots: {
            upcoming: [],
            past: [],
          },
        };
      }

      const slotObj = {
        sessionId: s.session_id,
        scheduled_at: s.scheduled_at,
        completed_at: s.completed_at,
        topics: [{ id: s.Topic?.node_id, name: s.Topic?.name }],
      };

      const completedTime = new Date(s.completed_at || s.scheduled_at);
      if (completedTime >= now) {
        grouped[teacherId].slots.upcoming.push(slotObj);
      } else {
        grouped[teacherId].slots.past.push(slotObj);
      }
    }

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
