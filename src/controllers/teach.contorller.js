import { SessionSummaires } from "../Models/SessionsummariesModel.js";
import { Teachertopicstats } from "../Models/TeachertopicstatsModel.js";
import { Op, fn, col } from "sequelize";
import { Topic } from "../Models/CatalogModels/TopicModel.js";
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

export const offerSlot = async (req, res) => {
  try {
    const teacher_id = req.user.id; // assuming user is authenticated
    const { topic_id, date, timeRange } = req.body;
const user=await User.findByPk(teacher_id)
const teacher_location=user.location;
if(!teacher_location || teacher_location===null){
     return res.status(400).json({ message: "please fill the location in profile to offer a slot" });
}
    if (!topic_id || !date || !timeRange) {
      return res.status(400).json({ message: "Missing topic_id, date or timeRange." });
    } // Parse time range like "14:00 - 15:00"
    const [startTimeStr, endTimeStr] = timeRange.split("-");
    const scheduled_at = new Date(`${date} ${startTimeStr}`);
    const completed_at = new Date(`${date} ${endTimeStr}`);
    const duration_minutes=Math.round((completed_at)-scheduled_at)/(1000*60);
console.log(scheduled_at,completed_at);
    const now = new Date();
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
if (scheduled_at < twoHoursLater) {
      return res.status(400).json({ message: "You can only offer a slot at least 2 hours from now." });
    }

    // Optional: prevent double booking on same time for same teacher
    const overlapping = await Session.findOne({
      where: {
        teacher_id,
        status: "available",
        scheduled_at: {
          [Op.lt]: completed_at
        },
        completed_at: {
          [Op.gt]: scheduled_at
        }
      }
    });

    if (overlapping) {
      return res.status(400).json({ message: "You already have an offered slot during this time." });
    }

    const session = await Session.create({
      teacher_id,
      topic_id,
      scheduled_at,
      completed_at,
      duration_minutes,
      status: "available",
   });

    return res.status(201).json({ message: "Slot offered successfully", session });

  } catch (err) {
    console.error("Offer slot error:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
};


// Helper to convert UTC date to IST
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

    // 1. Calculate today's date and 7 days ahead in UTC
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 7);

    // 2. Fetch sessions between today and 7 days from now
    const sessions = await Session.findAll({
      where: {
        teacher_id,
        status: "available",
        scheduled_at: {
          [Op.between]: [today, endDate],
        },
      },
      order: [["scheduled_at", "ASC"]],
    });

    // 3. Build empty chart for next 7 days
    const availability = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);
      const dateKey = formatDate(convertUTCToIST(date));
      availability[dateKey] = []; // default empty array
    }

    // 4. Map sessions to respective IST dates
    sessions.forEach((session) => {
      const istStart = session.scheduled_at;
      const istEnd = session.completed_at;
      const dateKey = formatDate(istStart);

      if (availability[dateKey]) {
        availability[dateKey].push({
          id: session.id,
          topic_id: session.topic_id,
          scheduled_at: istStart.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
          completed_at: istEnd.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
          status: session.status,
        });
      }
    });

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
    const { date, timeRange,topic_id } = req.body;

    const session = await Session.findByPk(sessionId);

    if (!session || session.teacher_id !== teacher_id || session.status !== "available") {
      return res.status(404).json({ error: "Slot not found or unauthorized" });
    }

    const [startTimeStr, endTimeStr] = timeRange.split("-");
    const scheduled_at = new Date(`${date} ${startTimeStr}`);
    const completed_at = new Date(`${date} ${endTimeStr}`);
   const duration_minutes=Math.round((completed_at)-scheduled_at)/(1000*60);
    const now = new Date();
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    if (scheduled_at < twoHoursLater) {
      return res.status(400).json({ error: "Updated slot must be at least 2 hours ahead." });
    }

    session.scheduled_at = scheduled_at;
    session.completed_at = completed_at;
    session.topic_id=topic_id;
     session.duration_minutes=duration_minutes;
    await session.save();

    return res.status(200).json({ message: "Slot updated successfully", session });

  } catch (err) {
    console.error("Update slot error:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
};
export const deleteAvailabilitySlot = async (req, res) => {
  try {
    const teacher_id = req.user.id;
    const sessionId = req.params.id;

    const session = await Session.findByPk(sessionId);

    if (!session || session.teacher_id !== teacher_id || session.status !== "available") {
      return res.status(404).json({ error: "Slot not found or unauthorized" });
    }

    await session.destroy();

    return res.status(200).json({ message: "Slot deleted successfully" });

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

    const { tier, rating, sessionCount } = stat;

    let eligible = false;
    let reason = 'Eligibility criteria not met';

    if (['Expert', 'Master', 'Legend'].includes(tier)) {
      eligible = true;
      reason = `Eligible for paid sessions at ${tier} tier`;
    } else if (tier === 'Bridger' && rating >= 4.5 && sessionCount >= 20) {
      eligible = true;
      reason = 'Eligible based on performance (high rating + session count)';
    }

    return res.status(200).json({
      eligible,
      tier,
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

const tierProgression = {
  Bridger: { next: 'Expert', sessions: 20, rating: 4.2 },
  Expert: { next: 'Master', sessions: 50, rating: 4.5 },
  Master: { next: 'Legend', sessions: 100, rating: 4.7 },
  Legend: null // No next tier
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
        const { tier, rating, sessionCount } = stat;
        const topicId = stat.Topic?.node_id;
        const topicName = stat.Topic?.name || "Unknown";

        // Find subject and domain
        const { subject, domain } = await findSubjectAndDomain(topicId);

        const progression = tierProgression[tier]; // You should have this map defined

        if (!progression) {
          return {
            topicId,
            topicName,
            currentTier: tier,
            rating,
            sessionCount,
            nextTier: null,
            sessionsToNextTier: 0,
            meetsRatingForNextTier: null,
            subject,
            domain
          };
        }

        const sessionsRemaining = Math.max(0, progression.sessions - sessionCount);
        const meetsRating = rating >= progression.rating;

        return {
          topicId,
          topicName,
          currentTier: tier,
          rating,
          sessionCount,
          nextTier: progression.next,
          sessionsToNextTier: sessionsRemaining,
          meetsRatingForNextTier: meetsRating,
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
      // Fetch topic name manually
      let topicName = "N/A";
      if (s.topic_id) {
        const topic = await CatalogueNode.findByPk(s.topic_id, {
          attributes: ["name"],
        });
        topicName = topic?.name || "N/A";
      }

      // Fetch student info manually
      let learner = null;
      if (s.student_id) {
        const student = await User.findByPk(s.student_id, {
          attributes: ["id", "firstName", "email"],
        });
        learner = {
          id: student?.id || null,
          name: student?.firstName || "Unknown",
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



