import Feedback from "../Models/feedbackModels.js";
import { User } from "../Models/UserModels/UserModel.js";
import { CatalogueNode } from "../Models/CatalogModels/catalogueNode.model.js";
// import { Topic } from "../Models/CatalogModels/TopicModel.js";
import { Op } from "sequelize";
import { Session } from "../Models/SessionModel.js";
import { findSubjectAndDomain } from "../utils/getsubject.js";
import { Teachertopicstats } from "../Models/TeachertopicstatsModel.js";
import { FeedbackSummary } from "../Models/feedbacksummary.js";
import { handleAllFeedbackSummaries } from "../utils/updatefeedbacksummary.js";
import jwt from 'jsonwebtoken';
import { transporter } from "../config/mailer.js";

export const verifyFeedbackToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log("🔐 Received Authorization Header:", authHeader);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log("❌ No token provided or malformed Authorization header");
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  console.log("🔍 Extracted Token:", token);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("✅ Decoded Token:", decoded);
    req.user = decoded;
    next();
  } catch (err) {
    console.log("❌ Token verification failed:", err.message);
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// ✅ POST Feedback


export const postFeedBack = async (req, res) => {
  try {
    console.time("Total Feedback Request");

    const {
      session_id,
      star_rating,
      helpfulness_rating,
      clarity_rating,
      pace_feedback,
      engagement_yn,
      confidence_gain_yn,
      text_feedback,
      flagged_issue,
      flag_reason,
    } = req.body;

    if (!session_id) return res.status(400).json({ success: false, message: "Missing session ID" });
    if (star_rating === undefined) return res.status(400).json({ success: false, message: "Missing star rating" });
    if (flagged_issue && !flag_reason) return res.status(400).json({ success: false, message: "Flag reason required" });

    const session = await Session.findByPk(session_id);
    if (!session) return res.status(404).json({ success: false, message: "Session not found" });

    const learner_id = session.student_id;
    const bridger_id = session.teacher_id;
    const topic_id = session.topic_id;

    // 🔍 Get topic node
    const topic = await CatalogueNode.findByPk(topic_id);
    if (!topic || !topic.is_topic) return res.status(400).json({ success: false, message: "Invalid topic node" });

    // 🔁 Climb to find subject and domain
    let currentNode = topic;
    let subject = null;
    let domain = null;

    while (currentNode?.parent_id) {
      const parent = await CatalogueNode.findByPk(currentNode.parent_id);
      if (!parent) break;

      if (!subject && parent.is_subject) subject = parent;
      if (!domain && parent.is_domain) domain = parent;

      currentNode = parent;
      if (subject && domain) break;
    }

    if (!subject || !domain) {
      return res.status(400).json({ success: false, message: "Subject or Domain not found in node hierarchy" });
    }

    // 🔁 Rate-limit check
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const recentCount = await Feedback.count({
      where: {
        learner_id,
        created_at: { [Op.gt]: twoMinutesAgo },
      },
    });
    if (recentCount >= 5) return res.status(429).json({ success: false, message: "Rate limit exceeded" });

    const existing = await Feedback.findOne({ where: { session_id } });
    if (existing) return res.status(409).json({ success: false, message: "Already submitted" });

    // ✅ Submit feedback
    const feedback = await Feedback.create({
      learner_id,
      session_id,
      bridger_id,
      topic_id,
      topic_name: topic.name,
      subject_id: subject.node_id,
      subject_name: subject.name,
      domain_id: domain.node_id,
      domain_name: domain.name,
      star_rating,
      helpfulness_rating,
      clarity_rating,
      pace_feedback,
      engagement_yn,
      confidence_gain_yn,
      text_feedback,
      flagged_issue,
      flag_reason,
    });

    await handleAllFeedbackSummaries({
      teacher_id: bridger_id,
      topic_id,
      newFeedback: {
        star_rating,
        clarity_rating,
        helpfulness_rating,
        pace_feedback,
        engagement_yn,
        confidence_gain_yn,
      },
    });

    // ================================
    // 📧 SEND EMAIL TO TEACHER
    // ================================

    try {
      const teacher = await User.findByPk(bridger_id);
      const learner = await User.findByPk(learner_id);

      if (teacher?.email) {
        await transporter.sendMail({
          from: `"TOTLE" <${process.env.EMAIL_USER}>`,
          to: teacher.email,
          subject: "📢 New Session Feedback Received",
          html: `
            <div style="font-family: Arial, sans-serif; padding:20px;">
              <h2>New Feedback Received</h2>
              
              <p><strong>Learner:</strong> ${learner?.firstName || "Student"}</p>
              <p><strong>Topic:</strong> ${topic.name}</p>
              <p><strong>Subject:</strong> ${subject.name}</p>
              <p><strong>Domain:</strong> ${domain.name}</p>
              
              <hr/>
              
              <p><strong>⭐ Star Rating:</strong> ${star_rating}/5</p>
              <p><strong>Helpfulness:</strong> ${helpfulness_rating || "N/A"}</p>
              <p><strong>Clarity:</strong> ${clarity_rating || "N/A"}</p>
              <p><strong>Pace:</strong> ${pace_feedback || "N/A"}</p>
              <p><strong>Engaging:</strong> ${engagement_yn ? "Yes" : "No"}</p>
              <p><strong>Confidence Gained:</strong> ${confidence_gain_yn ? "Yes" : "No"}</p>
              
              ${
                text_feedback
                  ? `<p><strong>Feedback Comment:</strong><br/>${text_feedback}</p>`
                  : ""
              }

              ${
                flagged_issue
                  ? `<p style="color:red;"><strong>⚠ Flagged Issue:</strong><br/>${flag_reason}</p>`
                  : ""
              }

              <hr/>
              <p>Keep up the great work! 💪</p>
            </div>
          `,
        });

        console.log("📧 Feedback email sent to teacher");
      }
    } catch (emailError) {
      console.error("❌ Email sending failed:", emailError.message);
      // DO NOT break main flow
    }

    console.timeEnd("Total Feedback Request");

    return res.status(201).json({
      success: true,
      message: "Feedback submitted successfully",
      data: feedback,
    });
  } catch (error) {
    console.error("❌ Error creating feedback:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};



// ✅ GET Feedback Summary for Learner or Qualified Teacher

export const getAllFeedback = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.bridger_id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "Missing user identity.",
      });
    }

    // Fetch teacher's qualified topics
    const qualifiedTopics = await Teachertopicstats.findAll({
      where: { teacherId: userId },
    
    });
console.log(qualifiedTopics);
    const isTeacher = qualifiedTopics.length > 0;
    const isLearner = !isTeacher;

    let whereCondition = {};
    if (isTeacher) {
      whereCondition = {
        bridger_id: userId,
        topic_id: {
          [Op.in]: qualifiedTopics.map((topic) => topic.node_id), // ✅ Fixed: was topic.id
        },
      };
    } else if (isLearner) {
      whereCondition = {
        learner_id: userId,
      };
    } else {
      return res.status(403).json({ success: false, message: "Unauthorized role" });
    }

    // Pagination params
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Fetch feedbacks
    const feedbacks = await Feedback.findAll({
      where: whereCondition,
      include: [
        {
          model: User,
          as: "learner",
          attributes: ["firstName", "lastName"],
        },
        {
          model: CatalogueNode,
          as: "topicNode",
          include: [
            {
              model: CatalogueNode,
              as: "parent", // subject
              include: [
                {
                  model: CatalogueNode,
                  as: "parent", // domain
                },
              ],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
      limit,
      offset,
    });

    const totalFeedbacks = await Feedback.count({ where: whereCondition });

    const avg = (arr, key) =>
      arr.reduce((sum, f) => sum + (f[key] || 0), 0) /
      (arr.filter((f) => f[key] != null).length || 1);

    const lastTen = feedbacks.slice(0, 10);
    const filtered = feedbacks;

    const responseData = {
      star_rating: {
        last_ten_sessions: parseFloat((avg(lastTen, "star_rating") || 0).toFixed(1)),
        lifetime: parseFloat((avg(filtered, "star_rating") || 0).toFixed(1)),
      },
      helpfulness_avg: parseFloat(avg(filtered, "helpfulness_rating").toFixed(1)),
      clarity_avg: parseFloat(avg(filtered, "clarity_rating").toFixed(1)),
      confidence_gain: `${Math.round(
        (filtered.filter((f) => f.confidence_gain_yn).length / filtered.length) * 100
      )}%`,
      engagement: `${Math.round(
        (filtered.filter((f) => f.engagement_yn).length / filtered.length) * 100
      )}%`,
      pace_trend: {
        fast: filtered.filter((f) => f.pace_feedback === "Too Fast").length,
        normal: filtered.filter((f) => f.pace_feedback === "Just Right").length,
        slow: filtered.filter((f) => f.pace_feedback === "Too Slow").length,
      },
      no_of_flag_warning: isTeacher
        ? undefined
        : filtered.filter((f) => f.flagged_issue).length,
      text_feedback: [],
    };

    // Group text feedbacks
    const groupedFeedback = {};

    filtered.forEach((fb) => {
      if (!fb.text_feedback) return;

      const topicNode = fb.topicNode;
      const subjectNode = topicNode?.parent;
      const domainNode = subjectNode?.parent;

      const topic = topicNode?.name || "Unknown Topic";
      const subject = subjectNode?.name || "Unknown Subject";
      const domain = domainNode?.name || "Unknown Domain";

      const date = new Date(fb.created_at).toLocaleDateString("en-GB");

      if (!groupedFeedback[domain]) groupedFeedback[domain] = {};
      if (!groupedFeedback[domain][subject]) groupedFeedback[domain][subject] = {};
      if (!groupedFeedback[domain][subject][topic]) {
        groupedFeedback[domain][subject][topic] = {
          name: topic,
          date,
          feedback: [],
        };
      }

      const learner = fb.learner;
      const learnerName = learner
        ? [learner.firstName, learner.lastName].filter(Boolean).join(" ")
        : "Anonymous";

      groupedFeedback[domain][subject][topic].feedback.push({
        learner_name: learnerName,
        text: fb.text_feedback,
        rating: fb.star_rating,
        comment:
          fb.star_rating >= 4
            ? "POSITIVE"
            : fb.star_rating === 3
            ? "NEUTRAL"
            : "NEGATIVE",
      });
    });

    // Convert nested grouped data into frontend-friendly array
    for (const [domain, subjects] of Object.entries(groupedFeedback)) {
      const subjectArray = [];
      for (const [subject, topics] of Object.entries(subjects)) {
        for (const topic of Object.values(topics)) {
          subjectArray.push({ name: subject, topic });
        }
      }
      responseData.text_feedback.push({ domain, subject: subjectArray });
    }

    return res.status(200).json({
      success: true,
      currentPage: page,
      perPage: limit,
      total: totalFeedbacks,
      data: responseData,
    });
  } catch (err) {
    console.error("❌ Error in getAllFeedback:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};






export const getAllFlaggedFeedbacks = async (req, res) => {
  try {
    // Step 1: Get all flagged feedbacks
    const feedbacks = await Feedback.findAll({
      where: { flagged_issue: true },
      raw: true,
    });

    const results = [];

    for (const fb of feedbacks) {
      // Step 2: Get learner info
      const learner = await User.findOne({
        where: { id: fb.learner_id },
        attributes: ["first_name", "last_name", "email"],
        raw: true,
      });

      // Step 3: Get session info
      const session = await Session.findOne({
        where: { id: fb.session_id },
        attributes: ["teacher_id", "topic_id"],
        raw: true,
      });

      // Step 4: Get teacher info
      let teacher = null;
      if (session?.teacher_id) {
        teacher = await User.findOne({
          where: { id: session.teacher_id },
          attributes: ["first_name", "last_name", "email"],
          raw: true,
        });
      }

      // Step 5: Get topic name
      let topic = null;
      if (session?.topic_id) {
        topic = await CatalogueNode.findOne({
          where: { node_id: session.topic_id },
          attributes: ["name"],
          raw: true,
        });
      }

      // Step 6: Combine everything
      results.push({
        feedback_id: fb.id,
        learner_name: `${learner?.first_name || ""} ${learner?.last_name || ""}`.trim(),
        learner_email: learner?.email || "N/A",
        teacher_name: `${teacher?.first_name || ""} ${teacher?.last_name || ""}`.trim(),
        teacher_email: teacher?.email || "N/A",
        topic_name: topic?.name || "Unknown",
        flag_reason: fb.flag_reason || "Not specified",
        text_feedback: fb.text_feedback || "",
        star_rating: fb.star_rating || 0,
        created_at: fb.created_at,
      });
    }

    return res.status(200).json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (err) {
    console.error("❌ Error fetching flagged feedbacks for admin:", err);
    return res.status(500).json({ success: false, message: "SERVER_ERROR" });
  }
};

// why using the feedback summmary table
export const getTopicAveragesFromSummary = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const topics = await FeedbackSummary.findAll({
      where: {
        teacher_id: teacherId,
        node_type: "topic",
      }, include:{
        model:CatalogueNode,
        attributes:["node_id","name"]
      },
      raw: true,
    });

    return res.status(200).json({
      success: true,
      data: topics,
    });
  } catch (err) {
    console.error("❌ Error fetching topic averages from summary:", err.message);
    return res.status(500).json({ success: false, message: "SERVER_ERROR" });
  }
};

export const getSubjectAveragesFromSummary = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const subjects = await FeedbackSummary.findAll({
      where: {
        teacher_id: teacherId,
        node_type: "subject",
      }, include:{
        model:CatalogueNode,
        attributes:["node_id","name"]
      },
      raw: true,
    });

    return res.status(200).json({
      success: true,
      data: subjects,
    });
  } catch (err) {
    console.error("❌ Error fetching subject averages from summary:", err.message);
    return res.status(500).json({ success: false, message: "SERVER_ERROR" });
  }
};
export const getDomainAveragesFromSummary = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const domains = await FeedbackSummary.findAll({
      where: {
        teacher_id: teacherId,
        node_type: "domain",
      }, include:{
        model:CatalogueNode,
        attributes:["node_id","name"]
      },
      raw: true,
    });

    return res.status(200).json({
      success: true,
      data: domains,
    });
  } catch (err) {
    console.error("❌ Error fetching domain averages from summary:", err.message);
    return res.status(500).json({ success: false, message: "SERVER_ERROR" });
  }
};

export const getLifetimeFeedback = async (req, res) => {
  try {
    const teacherId = req.user?.id; // ✔ always valid from token

    // 🔧 FIX: convert string "null" → real null
    if (!teacherId || teacherId === "null" || teacherId === "undefined") {
      return res.status(400).json({
        success: false,
        message: "Missing or invalid teacher ID",
      });
    }
    console.log("🔥 FEEDBACK LIFETIME INPUT:", {
  query: req.query,
  bridger_id: req.query.bridger_id,
  headersAuth: req.headers.authorization,
  userFromToken: req.user
});
    // -----------------------------
    // 1. Fetch topic-level summary
    // -----------------------------
    const topicSummary = await FeedbackSummary.findAll({
      where: {
        teacher_id: teacherId,
        node_type: "topic",
      },
      raw: true,
    });

 if (!topicSummary.length) {
  return res.status(200).json({
    success: true,
    message: "No feedback found yet",
    data: {
      star_rating: {
        last_ten_sessions: 0,
        lifetime: 0,
      },
      helpfulness_avg: 0,
      clarity_avg: 0,
      confidence_gain: "0%",
      engagement: "0%",
      pace_trend: {
        fast: 0,
        normal: 0,
        slow: 0,
      },
      no_of_flag_warning: 0,
      text_feedback: [],
    }
  });
}


    // -----------------------------
    // Helper functions
    // -----------------------------
    const avg = (key) =>
      topicSummary.reduce((sum, r) => sum + (+r[key] || 0), 0) /
      (topicSummary.length || 1);

    const percent = (key) =>
      Math.round(
        topicSummary.reduce((sum, r) => sum + (+r[key] || 0), 0) /
          (topicSummary.length || 1)
      );

    const paceStats = {
      fast: topicSummary.reduce((s, r) => s + (r.pace_fast || 0), 0),
      normal: topicSummary.reduce((s, r) => s + (r.pace_normal || 0), 0),
      slow: topicSummary.reduce((s, r) => s + (r.pace_slow || 0), 0),
    };

    // -----------------------------------------------------
    // 2. Fetch all text feedbacks (actual Feedback table)
    // -----------------------------------------------------
    const topicStats = await Teachertopicstats.findAll({
      where: { teacherId },
      attributes: ["node_id"],
      raw: true,
    });

    const topicIds = topicStats.map((t) => t.node_id);

    const feedbacks = await Feedback.findAll({
      where: {
        bridger_id: teacherId,
        topic_id: { [Op.in]: topicIds },
        text_feedback: { [Op.ne]: null },
      },
      raw: true,
    });

    const flaggedCount = feedbacks.filter(
      (f) => f.flagged_issue && f.flag_reason
    ).length;

    // ----------------------------------------------------------
    // 3. Build domain → subject → topic hierarchy for frontend
    // ----------------------------------------------------------
    const domainSummary = await FeedbackSummary.findAll({
      where: { teacher_id: teacherId, node_type: "domain" },
      raw: true,
    });

    const subjectSummary = await FeedbackSummary.findAll({
      where: { teacher_id: teacherId, node_type: "subject" },
      raw: true,
    });

    const topicSummaryAll = await FeedbackSummary.findAll({
      where: { teacher_id: teacherId, node_type: "topic" },
      raw: true,
    });

    const feedbackMap = {};

    for (const fb of feedbacks) {
      const { domain, subject } = await findSubjectAndDomain(fb.topic_id);
      const topicNode = await CatalogueNode.findByPk(fb.topic_id);

      const domainName = domain?.name || "N/A";
      const subjectName = subject?.name || "Unknown";
      const topicName = topicNode?.name || "Unknown";

      // --- domain meta
      if (!feedbackMap[domainName]) {
        const d = domainSummary.find((x) => x.node_id === domain?.id);
        feedbackMap[domainName] = {
          __meta: {
            id: domain?.id,
            avg_rating: d?.avg_star_rating || 0,
            helpfulness: d?.avg_helpfulness_rating || 0,
            clarity: d?.avg_clarity_rating || 0,
            confidence: d?.confidence_gain_percent || 0,
            engagement: d?.engagement_percent || 0,
            pace_trend: {
              fast: d?.pace_fast || 0,
              normal: d?.pace_normal || 0,
              slow: d?.pace_slow || 0,
            },
          },
        };
      }

      // --- subject meta
      if (!feedbackMap[domainName][subjectName]) {
        const s = subjectSummary.find((x) => x.node_id === subject?.id);
        feedbackMap[domainName][subjectName] = {
          __meta: {
            id: subject?.id,
            avg_rating: s?.avg_star_rating || 0,
            helpfulness: s?.avg_helpfulness_rating || 0,
            clarity: s?.avg_clarity_rating || 0,
            confidence: s?.confidence_gain_percent || 0,
            engagement: s?.engagement_percent || 0,
            pace_trend: {
              fast: s?.pace_fast || 0,
              normal: s?.pace_normal || 0,
              slow: s?.pace_slow || 0,
            },
          },
        };
      }

      // --- topic meta
      if (!feedbackMap[domainName][subjectName][topicName]) {
        const t = topicSummaryAll.find((x) => x.node_id === fb.topic_id);
        feedbackMap[domainName][subjectName][topicName] = {
          name: topicName,
          date: fb.created_at?.split("T")[0],
          feedback: [],
          __meta: {
            id: fb.topic_id,
            avg_rating: t?.avg_star_rating || 0,
            helpfulness: t?.avg_helpfulness_rating || 0,
            clarity: t?.avg_clarity_rating || 0,
            confidence: t?.confidence_gain_percent || 0,
            engagement: t?.engagement_percent || 0,
            pace_trend: {
              fast: t?.pace_fast || 0,
              normal: t?.pace_normal || 0,
              slow: t?.pace_slow || 0,
            },
          },
        };
      }

      // --- learner name
      const user = await User.findByPk(fb.learner_id);
      const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ");

      // --- push feedback
      const label =
        fb.star_rating > 3 ? "POSITIVE" : fb.star_rating === 3 ? "NEUTRAL" : "NEGATIVE";

      feedbackMap[domainName][subjectName][topicName].feedback.push({
        learner_name: name || "Anonymous",
        text: fb.text_feedback,
        rating: fb.star_rating,
        comment: label,
      });
    }

    // convert map → array for frontend
    const grouped = Object.entries(feedbackMap).map(([domainName, subjects]) => ({
      domain: domainName,
      ...subjects.__meta,
      subject: Object.entries(subjects)
        .filter(([k]) => k !== "__meta")
        .map(([subjectName, topics]) => ({
          name: subjectName,
          ...topics.__meta,
          topic: Object.entries(topics)
            .filter(([k]) => k !== "__meta")
            .map(([topicName, t]) => ({
              name: t.name,
              date: t.date,
              feedback: t.feedback,
              ...t.__meta,
            })),
        })),
    }));

    // -----------------------------
    // FINAL RESPONSE
    // -----------------------------
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
        no_of_flag_warning: flaggedCount,
        text_feedback: grouped,
      },
    });
  } catch (err) {
    console.error("❌ Lifetime feedback fetch failed:", err);
    return res.status(500).json({ success: false, message: "SERVER_ERROR" });
  }
};

