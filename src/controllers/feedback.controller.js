import Feedback from "../Models/feedbackModels.js";
import { User } from "../Models/UserModels/UserModel.js";
import { CatalogueNode } from "../Models/CatalogModels/catalogueNode.model.js";
import { Topic } from "../Models/CatalogModels/TopicModel.js";
import { Op } from "sequelize";
import { Session } from "../Models/SessionModel.js";
// ✅ POST Feedback
export const postFeedBack = async (req, res) => {
  try {
    const {
      learner_id,
      session_id,
      bridger_id,
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

    if (!learner_id || !session_id || !bridger_id) {
      return res.status(400).json({
        success: false,
        message: "learner_id, session_id, and bridger_id are required.",
      });
    }

    if (star_rating === undefined) {
      return res.status(400).json({
        success: false,
        message: "star_rating is required and must be between 1 and 5.",
      });
    }

    if (flagged_issue && !flag_reason) {
      return res.status(400).json({
        success: false,
        message: "flag_reason is required when flagged_issue is marked.",
      });
    }
     const session = await Session.findByPk(session_id);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    const topic_id = session.topic_id;

    const feedback = await Feedback.create({
      learner_id,
      session_id,
      bridger_id,
      topic_id,
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

    return res.status(201).json({
      success: true,
      message: "Feedback submitted successfully",
      data: feedback,
    });
  } catch (error) {
    console.error("Error creating feedback:", error.message);
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

    const qualifiedTopics = await Topic.findAll({
      where: {
        qualified_teacher_ids: {
          [Op.contains]: [userId],
        },
      },
    });

    const isTeacher = qualifiedTopics.length > 0;
    const isLearner = !isTeacher;

    let whereCondition = {};
    if (isTeacher) {
      whereCondition = {
        bridger_id: userId,
        topic_id: {
          [Op.in]: qualifiedTopics.map((topic) => topic.id),
        },
      };
    } else if (isLearner) {
      whereCondition = {
        learner_id: userId,
      };
    } else {
      return res.status(403).json({ success: false, message: "Unauthorized role" });
    }

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
    });

    const filtered = isTeacher
      ? feedbacks.map((f) => {
          const json = f.toJSON();
          delete json.flagged_issue;
          delete json.flag_reason;
          return json;
        })
      : feedbacks;

    const lastTen = filtered.slice(0, 10);
    const lifetimeCount = filtered.length;

    const avg = (arr, key) =>
      arr.reduce((sum, f) => sum + (f[key] || 0), 0) /
      (arr.filter((f) => f[key] != null).length || 1);

    const responseData = {
      star_rating: {
        last_ten_sessions: parseFloat((avg(lastTen, "star_rating") || 0).toFixed(1)),
        lifetime: parseFloat((avg(filtered, "star_rating") || 0).toFixed(1)),
      },
      helpfulness_avg: parseFloat(avg(filtered, "helpfulness_rating").toFixed(1)),
      clarity_avg: parseFloat(avg(filtered, "clarity_rating").toFixed(1)),
      confidence_gain: `${Math.round(
        (filtered.filter((f) => f.confidence_gain_yn).length / lifetimeCount) * 100
      )}%`,
      engagement: `${Math.round(
        (filtered.filter((f) => f.engagement_yn).length / lifetimeCount) * 100
      )}%`,
      pace_trend: {
        fast: filtered.filter((f) => f.pace_feedback === "Too Fast").length,
        normal: filtered.filter((f) => f.pace_feedback === "Just Right").length,
        slow: filtered.filter((f) => f.pace_feedback === "Too Slow").length,
      },
      no_of_flag_warning: isTeacher
        ? undefined
        : feedbacks.filter((f) => f.flagged_issue).length,
      text_feedback: [],
    };

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
        ? `${learner.firstName || "Anonymous"} ${learner.lastName || ""}`.trim()
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
      count: filtered.length,
      data: responseData,
    });
  } catch (err) {
    console.error("Error in getAllFeedback:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
