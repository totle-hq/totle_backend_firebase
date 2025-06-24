import { SessionSummaires } from "../Models/SessionsummariesModel.js";
import { Teachertopicstats } from "../Models/TeachertopicstatsModel.js";
import { Op, fn, col } from "sequelize";
import { Topic } from "../Models/CatalogModels/TopicModel.js";
import { User } from "../Models/UserModels/UserModel.js";
import { ModerationFlag } from "../Models/moderatonflagsModel.js";
import { Session } from "../Models/SessionModel.js";
export const getupcommingsessions=async (req,res) => {
      
    try
    {
        const teacher_id= req.user.id; // must come from JWT
    const now = new Date();

    const sessions = await Session.findAll({
      where: {
        teacher_id,
        scheduled_at: { [Op.gt]: now },
        status:"booked"
      },
      order: [['scheduledAt', 'ASC']]
    });
if(sessions.length===0){
return res.status(400).json({message:"no session found ", success:false})
}
    res.status(200).json({message:"session exists",success:true,sessions});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'something went wrong ' });
  }
};

export const offerSlot = async (req, res) => {
  try {
    const teacher_id = req.user.id;
    const { topic_id, date, timeRange } = req.body;

    if (!topic_id || !date || !timeRange) {
      return res.status(400).json({ error: "Missing topicId, date or time range" });
    }

    const [startTimeStr, endTimeStr] = timeRange.split(" - ");

    const scheduled_at = new Date(`${date} ${startTimeStr}`);
    const completed_at = new Date(`${date} ${endTimeStr}`);

    const session = await Session.create({
      teacher_id,
      topic_id,
      scheduled_at,
      completed_at,
      status: "available"
    });

    return res.status(201).json({ message: "Slot offered successfully", session });

  } catch (err) {
    console.error("Offer slot error:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
};

export const bookSlot = async (req, res) => {
  try {
    const student_id = req.user.id;
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    const session = await Session.findByPk(sessionId);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (session.status !== "available") {
      return res.status(409).json({ error: "Session already booked or not available" });
    }

    // Prevent booking your own session (if learners = teachers in same table)
    if (session.teacher_id === student_id) {
      return res.status(403).json({ error: "Cannot book your own session" });
    }
    const user=await User.findByPk(learnerId);

console.log(user)
    // Book the session
    session.learner_name = user.firstName+" "+user.lastName;
    session.status = "booked";
    await session.save();

    return res.status(200).json({
      message: "Session booked successfully",
      session
    });
  } catch (err) {
    console.error("Book slot error:", err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
};
export const cancelSlot = async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.body;
    console.log(sessionId);
  const session = await Session.findByPk(sessionId);

    if (!session) {
      return res.status(404).json({ error: "Session not found" ,success:false});
    }

    if (session.status === "cancelled" || session.status === "completed") {
      return res.status(409).json({ error: "Cannot cancel completed or already cancelled session" ,success:false});
    }

    if (session.teacher_id !== userId ) {
      return res.status(403).json({ error: "Not authorized to cancel this session", success:false });
    }

    session.status = "cancelled";
    await session.save();

    return res.status(200).json({ message: "Session cancelled successfully", session , success:true });

  } catch (err) {
    console.error("Cancel session error:", err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
};
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
export const getAvailableSlotsForLearners = async (req, res) => {
  try {
    const { topicId } = req.query;
    const now = new Date();

    const whereClause = {
      status: "available",
      scheduled_at: { [Op.gt]: now }
    };

    if (topicId) {
      whereClause.topic_id = topicId;
    }

    const slots = await Session.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "teacher",
          attributes: ["id", "firstName", "lastName"]
        },
        {
          model: Topic,
          attributes: ["id", "name"]
        }
      ],
      order: [["scheduled_at", "ASC"]]
    });

    return res.status(200).json({
      success: true,
      data: slots
    });

  } catch (err) {
    console.error("❌ Error fetching available slots:", err);
    return res.status(500).json({ success: false, message: "SERVER_ERROR" });
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

export const submitSessionSummary = async (req, res) => {
  try {
    const teacher_id = req.user.id;
    const { id: sessionId } = req.params;
    const { summaryText, tags } = req.body;

    const session = await Session.findOne({ where: { id: sessionId, teacher_id } });
    if (!session) {
      return res.status(404).json({ error: 'Session not found or access denied' });
    }

    const existing = await SessionSummaires.findOne({ where: { sessionId } });
    if (existing) {
      return res.status(409).json({ error: 'Summary already submitted for this session' });
    }

    const summary = await SessionSummaires.create({
      sessionId,
      teacherId: teacher_id,
      summaryText,
      tags,
      submittedAt: new Date()
    });

    return res.status(201).json(summary);
  } catch (err) {
    console.error('Error submitting session summary:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
};

export const getMyTopics = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const stats = await Teachertopicstats.findAll({
      where: { teacherId },
      include: [{
        model: Topic,
        attributes: ['id', 'name']
      }]
    });

    const topics = stats.map(stat => ({
      topicId: stat.topicId,
      topicName: stat.Topic?.name || "Unknown",
      tier: stat.tier,
      rating: stat.rating,
      sessionCount: stat.sessionCount
    }));

    return res.status(200).json(topics);
  } catch (err) {
    console.error('Failed to fetch topics:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
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

export const addTeacherTopicStat = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { topicId } = req.body;

    if (!topicId) {
      return res.status(400).json({ error: "Missing topicId" });
    }

    const exists = await Teachertopicstats.findOne({ where: { teacherId, topicId } });

    if (exists) {
      return res.status(409).json({ message: "Topic already assigned to teacher" });
    }

    const newStat = await Teachertopicstats.create({
      teacherId,
      topicId,
      tier: 'Bridger',
      sessionCount: 0,
      rating: 0
    });

    return res.status(201).json({
      message: "Topic assigned successfully",
      data: newStat
    });
  } catch (err) {
    console.error("Failed to add teacher topic stat:", err);
    res.status(500).json({ error: "SERVER_ERROR" });
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
      include: [{ model: Topic, attributes: ['id', 'name'] }]
    });

    const result = stats.map(stat => {
      const { tier, rating, sessionCount } = stat;
      const topicId = stat.Topic?.id;
      const topicName = stat.Topic?.name || "Unknown";

      const progression = tierProgression[tier];

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

// export const getPaymentEligibilityStatus = async (req, res) => {
//   try {
//     const teacherId = req.user.id;

//     const stats = await Teachertopicstats.findAll({
//       where: { teacherId },
//       include: [{ model: Topic, attributes: ['id', 'name'] }]
//     });

//     const result = stats.map(stat => {
//       const { tier, rating, sessionCount } = stat;
//       const topicId = stat.Topic?.id;
//       const topicName = stat.Topic?.name || "Unknown";

//       const eligibleTiers = ["Expert", "Master", "Legend"];
//       const eligible = eligibleTiers.includes(tier);
//       const reason = eligible
//         ? `Eligible for payouts as ${tier}`
//         : `Not eligible for payouts at ${tier} tier`;

//       return {
//         topicId,
//         topicName,
//         tier,
//         rating,
//         sessionCount,
//         eligibleForPayout: eligible,
//         reason
//       };
//     });

//     return res.status(200).json(result);
//   } catch (err) {
//     console.error('Payout eligibility check failed:', err);
//     res.status(500).json({ error: 'SERVER_ERROR' });
//   }
// };

export const submitFeedback = async (req, res) => {

  try {
    const teacherId = req.user.id;
    const { id: sessionId } = req.params;
    const { rating, comment } = req.body;

    // 1. Fetch session
    const session = await Session.findByPk(sessionId);
if(!session){
   return res.status(403).json({ error: "Session not exist" });
}
// console.log(rating,comment);
// console.log(teacherId,"+",session.teacherId)
    if (session.teacher_id !== teacherId) {
      return res.status(403).json({ error: "Unauthorized or session not found" });
    }

    if (session.feedbackSubmitted) {
      return res.status(409).json({ error: "Feedback already submitted" });
    }

    // 2. Update session with feedback
    session.feedback_rating = rating;
    session.feedback_comment = comment;
    session.feedback_submitted= true;
    await session.save();

    // 3. Update TeacherTopicStat
    const stat = await Teachertopicstats.findOne({
      where: {
        teacherId,
        topicId: session.topic_id
      }
    });

    if (stat) {
      const newCount = stat.sessionCount + 1;
      const newRating = ((stat.rating * stat.sessionCount) + rating) / newCount;

      stat.sessionCount = newCount;
      stat.rating = newRating;
      await stat.save();
    }

    return res.status(200).json({ message: "Feedback saved successfully." });
  } catch (err) {
    console.error("Submit feedback error:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
};


export const getFeedbackSummary = async (req, res) => {
  try {
    const teacherId = req.user.id;
//    const ip =
//       req.headers['x-forwarded-for']?.split(',').shift() ||
//       req.socket?.remoteAddress;
// const userAgent = req.headers['user-agent'];
// console.log("User-Agent:", userAgent);

//     console.log("📡 Feedback Summary Requested by IP:", ip);
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

export const joinSession = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const sessionId = req.params.id;

    const session = await Session.findByPk(sessionId);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (session.teacher_id !== teacherId) {
      return res.status(403).json({ error: "Not your session" });
    }

    const scheduledTime = new Date(session.scheduled_at); 

    const now = new Date().toISOString();;
    console.log(now)
    const startWindow = new Date(scheduledTime.getTime() - 10 * 60000); // 10 min before
    const endWindow = new Date(scheduledTime.getTime() + 15 * 60000); // 15 min after

    if (now < startWindow || now > endWindow) {
      return res.status(400).json({ error: "Not within joinable time window" });
    }

    // Optionally: Validate device fingerprint here

    return res.status(200).json({ 
    
      message: " Join allowed",
      sessionId,
      scheduledAt: scheduledTime,
    });
  } catch (err) {
    console.error("Join session error:", err);
    return res.status(500).json({ error: "SERVER_ERROR" });
  }
};

