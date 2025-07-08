import { SessionSummaires } from "../Models/SessionsummariesModel.js";
import { Teachertopicstats } from "../Models/TeachertopicstatsModel.js";
import { Op, fn, col } from "sequelize";
import { Topic } from "../Models/CatalogModels/TopicModel.js";
import { User } from "../Models/UserModels/UserModel.js";
import { ModerationFlag } from "../Models/moderatonflagsModel.js";
import { Session } from "../Models/SessionModel.js";

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
          model: Topic,
          as: "Topic",
          attributes: ['id', 'name',"parent_id"]
        },
        {
          model: User,
          as: "teacher",
          attributes: ['id', 'location']
        }
      ]
    });

    const result = stats.map(stat => {
      const { tier, rating, sessionCount } = stat;
      const topicId = stat.Topic?.id;
      const topicName = stat.Topic?.name || "Unknown";

      const progression = tierProgression[tier];
console.log(stats)
      if (!progression) {
        return {
          topicId,
          topicName,
          currentTier: tier,
          rating,
          sessionCount,
          nextTier: null,
          sessionsToNextTier: 0,
          meetsRatingForNextTier: null
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
        meetsRatingForNextTier: meetsRating
      };
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('Progression fetch failed:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
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



