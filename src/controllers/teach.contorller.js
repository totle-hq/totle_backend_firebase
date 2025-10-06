import { SessionSummaires } from "../Models/SessionsummariesModel.js";
import { Teachertopicstats } from "../Models/TeachertopicstatsModel.js";
import { Op, fn, col } from "sequelize";
// import { Topic } from "../Models/CatalogModels/TopicModel.js";
import { User } from "../Models/UserModels/UserModel.js";
import { ModerationFlag } from "../Models/moderatonflagsModel.js";
import { Session } from "../Models/SessionModel.js";
import { CatalogueNode } from "../Models/CatalogModels/catalogueNode.model.js";
import { findSubjectAndDomain } from "../utils/getsubject.js";

export const reportSession = async (req, res) => {
  try {
    const teacher_id = req.user.id;
    const { sessionId, reportStatus, notes } = req.body;

    if (!sessionId || !reportStatus) {
      return res.status(400).json({ error: "sessionId and reportStatus are required" });
    }

    const session = await Session.findByPk(sessionId);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (session.teacher_id !== teacher_id) {
      return res.status(403).json({ error: "Not authorized to report this session" });
    }

    const allowedStatuses = ["completed", "learner-no-show", "incomplete", "interrupted", "technical-issue"];
    if (!allowedStatuses.includes(reportStatus)) {
      return res.status(400).json({ error: "Invalid reportStatus value" });
    }

    // Set session status
    if (reportStatus === "completed") {
      session.status = "completed";
    } else {
      session.status = "flagged";
    }

    await session.save();

    await ModerationFlag.create({
      sessionId: session.id,
      reporterId: teacher_id,
      reason: reportStatus,
      notes: notes || null,
      status: "open"
    });

    return res.status(200).json({
      message: "Session report and flag submitted successfully",
      session
    });

  } catch (err) {
    console.error("Report session error:", err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
};

function parse12HourTime(dateStr, timeStr) {
  if (!timeStr.includes("AM") && !timeStr.includes("PM")) {
    // It's in 24-hour format already
    return new Date(`${dateStr}T${timeStr}:00`);
  }

  const [time, modifier] = timeStr.trim().split(" ");
  let [hours, minutes] = time.split(":").map(Number);

  if (modifier.toUpperCase() === "PM" && hours !== 12) hours += 12;
  if (modifier.toUpperCase() === "AM" && hours === 12) hours = 0;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");

  return new Date(`${dateStr}T${hh}:${mm}:00`);
}


export const offerSlot = async (req, res) => {
  try {
    const teacher_id = req.user.id;
    const { topic_ids, date, timeRange } = req.body; // ✅ topic_ids is now an array

    const user = await User.findByPk(teacher_id);
    const teacher_location = user.location;

    if (!teacher_location) {
      return res.status(400).json({ message: "Please fill in your location in profile to offer a slot." });
    }

    if (!Array.isArray(topic_ids) || topic_ids.length === 0 || !date || !timeRange) {
      return res.status(400).json({ message: "Missing topic_ids array, date, or timeRange." });
    }

    const [startTimeStr, endTimeStr] = timeRange.split("-");
    const scheduled_at = parse12HourTime(date, startTimeStr);
    const completed_at = parse12HourTime(date, endTimeStr);

    // Handle if slot crosses midnight (e.g., 11:30 PM to 12:30 AM)
    if (completed_at <= scheduled_at) {
      completed_at.setDate(completed_at.getDate() + 1);
    }

    const duration_minutes = Math.round((completed_at - scheduled_at) / (1000 * 60));

    const now = new Date();
    // const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const twoHoursLater = new Date(now.getTime() + 30 * 60 * 1000);

    if (scheduled_at < twoHoursLater) {
      return res.status(400).json({ message: "You can only offer a slot at least 2 hours from now." });
    }

    // Optional: prevent any existing session overlap (teacher-wide)
    const overlapping = await Session.findOne({
      where: {
        teacher_id,
        status: "available",
        scheduled_at: { [Op.lt]: completed_at },
        completed_at: { [Op.gt]: scheduled_at }
      }
    });

    if (overlapping) {
      return res.status(400).json({ message: "You already have an offered slot during this time." });
    }

    // ✅ Create one session for each topic
    const createdSessions = [];

    for (const topic_id of topic_ids) {
      const session = await Session.create({
        teacher_id,
        topic_id,
        scheduled_at,
        completed_at,
        duration_minutes,
        status: "available"
      });

      createdSessions.push(session);
    }

    return res.status(201).json({ message: "Slots offered successfully", sessions: createdSessions });

  } catch (err) {
    console.error("Offer slot error:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
};

const convertUTCToIST = (utcDate) => {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  return new Date(new Date(utcDate).getTime() + istOffsetMs);
};

// Helper to format date as 'YYYY-MM-DD'
const formatDate = (dateObj) => {
  return dateObj.toISOString().split("T")[0];
};




export const getAvailabilityChart = async (req, res) => {
  try {
    const teacher_id = req.user.id;

    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 7);

    // 1. Get all sessions for the teacher in next 7 days
    const sessions = await Session.findAll({
      where: {
        teacher_id,
        status: "available",
        scheduled_at: {
          [Op.between]: [today, endDate],
        },
      },
      order: [["scheduled_at", "ASC"]],
      raw: true,
    });

    // 2. Get all unique topic IDs
    const allTopicIds = [...new Set(sessions.map(s => s.topic_id))];

    // 3. Fetch topic names
    const topicRecords = await CatalogueNode.findAll({
      where: { node_id: allTopicIds },
      attributes: ["node_id", "name"],
      raw: true,
    });

    // 4. Create a topic ID to name map
    const topicMap = {};
    topicRecords.forEach(topic => {
      topicMap[topic.node_id] = topic.name;
    });

    // 5. Initialize availability for 7 days
    const availability = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);
      const dateKey = formatDate(convertUTCToIST(date));
      availability[dateKey] = [];
    }

    // 6. Group sessions by time
    const timeMap = new Map();

    for (const session of sessions) {
      const scheduledTimeISO = new Date(session.scheduled_at).toISOString();
      const dateKey = formatDate(convertUTCToIST(session.scheduled_at));

      if (!timeMap.has(scheduledTimeISO)) {
        timeMap.set(scheduledTimeISO, {
          id: session.session_id, // single session id
          scheduled_at: session.scheduled_at.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
          completed_at: session.completed_at?.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) || null,
          topic_ids: [],
          topic_names: [],
          status: session.status,
        });
      }

      const entry = timeMap.get(scheduledTimeISO);
      entry.topic_ids.push(session.topic_id);
      entry.topic_names.push(topicMap[session.topic_id] || "Unknown");
    }

    // 7. Fill availability
    for (const [isoTime, group] of timeMap.entries()) {
      const dateKey = formatDate(convertUTCToIST(new Date(isoTime)));
      if (availability[dateKey]) {
        availability[dateKey].push(group);
      }
    }

    return res.status(200).json({ availability });

  } catch (err) {
    console.error("Error fetching availability chart:", err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
};






export const updateAvailabilitySlot = async (req, res) => {
  try {
    const teacher_id = req.user.id;
    const sessionId = req.params.id;
    const { date, timeRange, topic_ids = [] } = req.body;

    const session = await Session.findByPk(sessionId);

    if (!session || session.teacher_id !== teacher_id || session.status !== "available") {
      return res.status(404).json({ error: "Slot not found or unauthorized" });
    }

    const [startTimeStr, endTimeStr] = timeRange.split("-");
    const newScheduledAt = parse12HourTime(date, startTimeStr);
    const newCompletedAt = parse12HourTime(date, endTimeStr);

    if (newCompletedAt <= newScheduledAt) {
      newCompletedAt.setDate(newCompletedAt.getDate() + 1);
    }

    const duration_minutes = Math.round((newCompletedAt - newScheduledAt) / (1000 * 60));

    const now = new Date();
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    if (newScheduledAt < twoHoursLater) {
      return res.status(400).json({ error: "Updated slot must be at least 2 hours ahead." });
    }

    // 1. Find all existing sessions for the slot (same scheduled/completed time and teacher)
    const existingSessions = await Session.findAll({
      where: {
        teacher_id,
        status: "available",
        scheduled_at: session.scheduled_at,
        completed_at: session.completed_at,
      },
    });

    // 2. Get existing topic_ids
    const existingTopicIds = existingSessions.map((s) => s.topic_id);

    // 3. Find which topic_ids to add or remove
    const toAdd = topic_ids.filter((id) => !existingTopicIds.includes(id));
    const toKeep = topic_ids.filter((id) => existingTopicIds.includes(id));
    const toRemove = existingTopicIds.filter((id) => !topic_ids.includes(id));

    // 4. Update sessions to keep
    for (const s of existingSessions) {
      if (toKeep.includes(s.topic_id)) {
        s.scheduled_at = newScheduledAt;
        s.completed_at = newCompletedAt;
        s.duration_minutes = duration_minutes;
        await s.save();
      }
    }

    // 5. Delete sessions for removed topic_ids
    await Session.destroy({
      where: {
        teacher_id,
        status: "available",
        topic_id: toRemove,
        scheduled_at: session.scheduled_at,
        completed_at: session.completed_at,
      },
    });

    // 6. Create new sessions for added topic_ids
    const newSessions = toAdd.map((topic_id) => ({
      teacher_id,
      topic_id,
      scheduled_at: newScheduledAt,
      completed_at: newCompletedAt,
      status: "available",
      duration_minutes,
    }));

    if (newSessions.length > 0) {
      await Session.bulkCreate(newSessions);
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


export const deleteAvailabilitySlot = async (req, res) => {
  try {
    const teacher_id = req.user.id;
    const sessionId = req.params.id;

    // 1. Find the reference session
    const session = await Session.findByPk(sessionId);

    if (!session || session.teacher_id !== teacher_id || session.status !== "available") {
      return res.status(404).json({ error: "Slot not found or unauthorized" });
    }

    const { scheduled_at, completed_at } = session;

    // 2. Delete all sessions with same slot time for this teacher
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



export const validateSessionTime = async (req, res) => {
  try {
    const { id: sessionId } = req.params;

    const session = await Session.findByPk(sessionId);
    if (!session) {
      return res.status(404).json({ joinAllowed: false, reason: 'Session not found' });
    }

    const now = new Date();
    const scheduled = new Date(session.scheduled_at);

    const startWindow = new Date(scheduled.getTime() - 10 * 60000);
    const endWindow = new Date(scheduled.getTime() + 15 * 60000);

    const joinAllowed = now >= startWindow && now <= endWindow;
    const reason = joinAllowed
      ? 'Join allowed within window'
      : 'Join not allowed: Outside valid time window';

    return res.status(200).json({ joinAllowed, reason });
  } catch (err) {
    console.error('Time validation failed:', err);
    return res.status(500).json({ joinAllowed: false, reason: 'Internal server error' });
  }
};





export const validateEligibility = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { topicId } = req.body;

    if (!topicId) {
      return res.status(400).json({ error: 'Missing topicId' });
    }

    const stat = await Teachertopicstats.findOne({ where: { teacherId, topicId } });

    if (!stat) {
      return res.status(404).json({
        eligible: false,
        reason: 'No teacher record found for this topic'
      });
    }

    const { level, rating, sessionCount } = stat;

    let eligible = false;
    let reason = 'Eligibility criteria not met';

    if (['Expert', 'Master', 'Legend'].includes(level)) {
      eligible = true;
      reason = `Eligible for paid sessions at ${level} level`;
    } else if (level === 'Bridger' && rating >= 4.5 && sessionCount >= 20) {
      eligible = true;
      reason = 'Eligible based on performance (high rating + session count)';
    }

    return res.status(200).json({
      eligible,
      level,
      rating,
      sessionCount,
      reason
    });

  } catch (err) {
    console.error('Eligibility validation failed:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
};



export const getSessionSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { id: sessionId } = req.params;

    const summary = await SessionSummaires.findOne({ where: { sessionId } });

    if (!summary) {
      return res.status(404).json({ error: 'Summary not found' });
    }

    const isEditable = summary.teacherId === userId &&
      ['Bridger', 'Expert', 'Master', 'Legend'].includes(userRole);

    return res.status(200).json({
      summaryText: summary.summaryText,
      tags: summary.tags,
      submittedAt: summary.submittedAt,
      editable: isEditable
    });
  } catch (err) {
    console.error('Error fetching session summary:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
};

const levelProgression = {
  Bridger: { next: 'Expert', sessions: 20, rating: 4.2 },
  Expert: { next: 'Master', sessions: 50, rating: 4.5 },
  Master: { next: 'Legend', sessions: 100, rating: 4.7 },
  Legend: null // No next level
};




export const getMyProgression = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const stats = await Teachertopicstats.findAll({
      where: { teacherId },
      include: [
        {
          model: CatalogueNode,
          as: "Topic",
          attributes: ['node_id', 'name', 'parent_id']
        },
        {
          model: User,
          as: "teacher",
          attributes: ['id', 'location']
        }
      ]
    });

    const result = await Promise.all(
      stats.map(async (stat) => {
        const { level, rating, sessionCount } = stat;
        const topicId = stat.Topic?.node_id;
        const topicName = stat.Topic?.name || "Unknown";

        // Find subject and domain
        const { subject, domain } = await findSubjectAndDomain(topicId);

        const progression = levelProgression[level]; // You should have this map defined

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
            domain
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
          domain
        };
      })
    );

    return res.status(200).json(result);
  } catch (err) {
    console.error("Progression fetch failed:", err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
};


export const getUpcomingBookedSessions = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const now = new Date();

    const sessions = await Session.findAll({
      where: {
        teacher_id: teacherId,
        status: "booked",
        scheduled_at: {
          [Op.gt]: now,
        },
      },
      order: [["scheduled_at", "ASC"]],
    });

    const formatted = [];

   for (const s of sessions) {
  // Declare variables at the top
  let topicName = "N/A";
  let subject = "N/A";

  if (s.topic_id) {
    const topic = await CatalogueNode.findByPk(s.topic_id, {
      attributes: ["name"],
    });
    const result = await findSubjectAndDomain(s.topic_id);
    subject = result.subject || "N/A";
    topicName = topic?.name || "N/A";
  }

  // Fetch student info manually
  let learner = null;
  if (s.student_id) {
    const student = await User.findByPk(s.student_id, {
      attributes: ["id", "firstName", "lastName", "email"],
    });
    learner = {
      id: student?.id || null,
      name: student?.firstName + " " + student?.lastName || "Unknown",
      email: student?.email || "Not Available",
    };
  }

  formatted.push({
    session_id: s.id,
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





export const getFeedbackSummary = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const feedbackData = await Session.findAll({
      where: {
        teacher_id:teacherId,
        feedback_rating: { [Op.not]: null }
      },
      attributes: [
        "topicId",
        [fn("AVG", col("feedback_rating")), "averageRating"],
    [fn("COUNT", col("Session.id")), "sessionCount"]

      ],
      group: ["topic_id", "Topic.id"],
      include: [
        {
          model: Topic,
          attributes: ["id", "name"],
        }
      ]
    });

    const result = feedbackData.map(row => ({
      topicId: row.topicId,
      topicName: row.Topic?.name || "Unknown",
      averageRating: parseFloat(row.get("averageRating")),
      sessionCount: parseInt(row.get("sessionCount"))
    }));

    // Optional: Add overall average
    const overallAvg =
      result.reduce((acc, r) => acc + r.averageRating * r.sessionCount, 0) /
      result.reduce((acc, r) => acc + r.sessionCount, 0);

    return res.status(200).json({
      teacherId,
      averageRating: parseFloat(overallAvg.toFixed(2)),
      totalFeedbacks: result.reduce((acc, r) => acc + r.sessionCount, 0),
      feedbackByTopic: result
    });
  } catch (err) {
    console.error("Feedback summary error:", err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
};

export const getMyQualifiedTopics = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const stats = await Teachertopicstats.findAll({
      where: { teacherId },
      include: [
        {
          model: CatalogueNode,
          as: "Topic",
          attributes: ["node_id", "name", "parent_id"]
        }
      ]
    });

    const topicsMap = {};

    for (const stat of stats) {
      const topic = stat.Topic;
      if (!topic) continue; // Skip if no associated topic

      // Fetch parent subject node
      const subjectNode = await CatalogueNode.findByPk(topic.parent_id, {
        attributes: ["node_id", "name", "parent_id"]
      });

      // Fetch domain node (parent of subject)
      let domainNode = null;
      if (subjectNode?.parent_id) {
        domainNode = await CatalogueNode.findByPk(subjectNode.parent_id, {
          attributes: ["node_id", "name"]
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
          attributes: ["node_id", "name", "parent_id"]
        }
      ]
    });

    const topicsWithStats = [];

    for (const stat of stats) {
      const topic = stat.Topic;
      if (!topic) continue;

      // Fetch sessions taught on this topic by this teacher
      const sessions = await Session.findAll({
        where: {
          teacher_id: teacherId,
          topic_id: topic.node_id,
          status: "completed", // Only completed sessions
        },
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
