import Feedback from "../Models/feedbackModels.js";
import { User } from "../Models/UserModels/UserModel.js";
import { CatalogueNode } from "../Models/CatalogModels/catalogueNode.model.js";
import { Topic } from "../Models/CatalogModels/TopicModel.js";
import { Op } from "sequelize";
import { Session } from "../Models/SessionModel.js";
import { findSubjectAndDomain } from "../utils/getsubject.js";
import { Teachertopicstats } from "../Models/TeachertopicstatsModel.js";
import { FeedbackSummary } from "../Models/feedbacksummary.js";
import { handleAllFeedbackSummaries } from "../utils/updatefeedbacksummary.js";
// ✅ POST Feedback
export const postFeedBack = async (req, res) => {
  try {
    console.time("Total Feedback Request");

    const {
      learner_id, session_id, bridger_id,
      star_rating, helpfulness_rating, clarity_rating,
      pace_feedback, engagement_yn, confidence_gain_yn,
      text_feedback, flagged_issue, flag_reason,
    } = req.body;

    const now = new Date();
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);

    if (!learner_id || !session_id || !bridger_id) {
      return res.status(400).json({ success: false, message: "Missing IDs" });
    }

    if (star_rating === undefined) {
      return res.status(400).json({ success: false, message: "Missing star rating" });
    }

    if (flagged_issue && !flag_reason) {
      return res.status(400).json({ success: false, message: "Flag reason required" });
    }

    console.time("Get Session");
    const session = await Session.findByPk(session_id);
    console.timeEnd("Get Session");

    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    console.time("Check Recent Feedback Count");
    const recentCount = await Feedback.count({
      where: {
        learner_id,
        created_at: { [Op.gt]: twoMinutesAgo },
      },
    });
    console.timeEnd("Check Recent Feedback Count");

    if (recentCount >= 5) {
      return res.status(429).json({ success: false, message: "Rate limit exceeded" });
    }

    console.time("Check Existing Feedback for Session");
    const previousfeedback = await Feedback.findAll({
      where: { session_id }
    });
    console.timeEnd("Check Existing Feedback for Session");

    if (previousfeedback.length > 0) {
      return res.status(409).json({ message: "Already submitted", success: false });
    }

    const topic_id = session.topic_id;

    console.time("Create Feedback");
    const feedback = await Feedback.create({
      learner_id, session_id, bridger_id, topic_id,
      star_rating, helpfulness_rating, clarity_rating,
      pace_feedback, engagement_yn, confidence_gain_yn,
      text_feedback, flagged_issue, flag_reason,
    });
    console.timeEnd("Create Feedback");

    console.time("Update Feedback Summary");
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
    console.timeEnd("Update Feedback Summary");

  

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
    const { id: userId } = req.user;

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
   const teacherId = req.query.bridger_id;

    // 1. Get all summary rows for the teacher
   const summary = await FeedbackSummary.findAll({
  where: {
    teacher_id: teacherId,
    node_type: 'topic', // ✅ Only topic-level summaries
  },
  raw: true,
});

    if (!summary.length) {
      return res.status(200).json({
        success: true,
        message: "No feedback available yet.",
        data: null,
      });
    }

    // 2. Aggregate all summary averages
    const avg = (key) =>
      summary.reduce((sum, r) => sum + (parseFloat(r[key]) || 0), 0) / summary.length;

    const percent = (key) =>
      Math.round(
        summary.reduce((sum, r) => sum + (parseFloat(r[key]) || 0), 0) /
          (summary.length || 1)
      );

    const paceStats = {
      fast: summary.reduce((sum, r) => sum + (r.pace_fast || 0), 0),
  
      normal: summary.reduce((sum, r) => sum + (r.pace_normal || 0), 0),
  
      slow: summary.reduce((sum, r) => sum + (r.pace_slow || 0), 0),
    };

    // 3. Get all text feedbacks (non-summary, real-time fetch)
    const topicStats = await Teachertopicstats.findAll({
      where: { teacherId },
      attributes: ["node_id"],
    });

    const topicIds = topicStats.map((t) => t.node_id);

    const feedbacks = await Feedback.findAll({
      where: {
        topic_id: { [Op.in]: topicIds },
        bridger_id: teacherId,
        text_feedback: { [Op.ne]: null },
      },
      raw: true,
    });

    const flagged = feedbacks.filter(
      (f) => f.flagged_issue && f.flag_reason?.length
    ).length;

    // 4. Format text feedback
    const feedbackMap = {};
     const domainsummary = await FeedbackSummary.findAll({
  where: {
    teacher_id: teacherId,
    node_type: 'domain',
 

  },
  raw: true,
});
const topicsummary = await FeedbackSummary.findAll({
  where: {
    teacher_id: teacherId,
    node_type: 'topic',
  },
  raw: true,
});

const subjectsummary=await FeedbackSummary.findAll({
  where:{
        teacher_id: teacherId,
    node_type: 'subject',
  },
  raw:true
})
    for (const fb of feedbacks) {
      const { domain, subject } = await findSubjectAndDomain(fb.topic_id);

      const domainName = domain?.name || "N/A";
      const subjectName = subject?.name || "Unknown";
       const topic=await CatalogueNode.findByPk(fb.topic_id);
      const topicName=topic.name;
      const topicKey = topicName || "Unknown";


     if (!feedbackMap[domainName]) {
  const domainDetails = domainsummary.find(d => d.node_id === domain.id);


  feedbackMap[domainName] = {
    __meta: {
      id: domain.id,
      avg_rating: domainDetails?.avg_star_rating || 0,
      helpfulness: domainDetails?.avg_helpfulness_rating || 0,
      clarity: domainDetails?.avg_clarity_rating || 0,
      confidence: domainDetails?.confidence_gain_percent || 0,
      engagement_yn:domainDetails?.engagement_percent ||0,
      pace_trend:{
        fast:domainDetails?.pace_fast||0,
        normal:domainDetails.pace_normal||0,
        slow:domainDetails.pace_slow||0,
      }
    }
  };
}

        
if (!feedbackMap[domainName][subjectName]) {
  const subjectDetails = subjectsummary.find(s => s.node_id === subject.id);

  feedbackMap[domainName][subjectName] = {
    __meta: {
      id: subject.id,
      avg_rating: subjectDetails?.avg_star_rating || 0,
      helpfulness: subjectDetails?.avg_helpfulness_rating || 0,
      clarity: subjectDetails?.avg_clarity_rating || 0,
      confidence: subjectDetails?.confidence_gain_percent || 0,
      engagement_yn: subjectDetails?.engagement_percent || 0,
      pace_trend: {
        fast: subjectDetails?.pace_fast || 0,
        normal: subjectDetails?.pace_normal || 0,
        slow: subjectDetails?.pace_slow || 0,
      }
    }
  };
}

 if (!feedbackMap[domainName][subjectName][topicKey]) {
  const topicDetails = topicsummary.find(t => t.node_id === fb.topic_id);

  feedbackMap[domainName][subjectName][topicKey] = {
    name: topicKey,
    date: fb.created_at.toISOString().split("T")[0],
    feedback: [],
    __meta: {
      id: fb.topic_id,
      avg_rating: topicDetails?.avg_star_rating || 0,
      helpfulness: topicDetails?.avg_helpfulness_rating || 0,
      clarity: topicDetails?.avg_clarity_rating || 0,
      confidence: topicDetails?.confidence_gain_percent || 0,
      engagement_yn: topicDetails?.engagement_percent || 0,
      pace_trend: {
        fast: topicDetails?.pace_fast || 0,
        normal: topicDetails?.pace_normal || 0,
        slow: topicDetails?.pace_slow || 0,
      }
    }
  };
}

let name="";
const user=await User.findByPk(fb.learner_id);
name=[user.firstName,user.lastName].filter(Boolean).join(" ");
      feedbackMap[domainName][subjectName][topicKey].feedback.push({
        learner_name: name || "Anonymous",
        text: fb.text_feedback,
        rating: fb.star_rating || 0,
        comment: fb.flag_reason || "",
      });
    }





const groupedFeedbackArray = Object.entries(feedbackMap).map(
  ([domainName, subjects]) => {
    const meta = subjects.__meta || {};

    return {
      domain: domainName,
      domain_avg_rating: +parseFloat(meta.avg_rating).toFixed(2),
      domain_helpfulness_avg: +parseFloat(meta.helpfulness).toFixed(2),
      domain_clarity_avg: +parseFloat(meta.clarity).toFixed(2),
      domain_confidence_gain: `${Math.round(meta.confidence)}%`,
      domain_engagement_yn:`${Math.round(meta.engagement_yn)}%`,
      domain_pace_stats:meta.pace_trend,
    subject: Object.entries(subjects)
  .filter(([key]) => key !== "__meta")
  .map(([subjectName, topics]) => {
    const subjectMeta = topics.__meta || {};

    return {
      name: subjectName,
      subject_avg_rating: +parseFloat(subjectMeta.avg_rating).toFixed(2),
      subject_helpfulness_avg: +parseFloat(subjectMeta.helpfulness).toFixed(2),
      subject_clarity_avg: +parseFloat(subjectMeta.clarity).toFixed(2),
      subject_confidence_gain: `${Math.round(subjectMeta.confidence)}%`,
      subject_engagement_yn: `${Math.round(subjectMeta.engagement_yn)}%`,
      subject_pace_stats: subjectMeta.pace_trend,
      topic: Object.entries(topics)
  .filter(([key]) => key !== "__meta")
  .map(([topicName, topicData]) => {
    return {
      name: topicData.name,
      date: topicData.date,
      feedback: topicData.feedback,
      topic_avg_rating: +parseFloat(topicData.__meta?.avg_rating || 0).toFixed(2),
      topic_helpfulness_avg: +parseFloat(topicData.__meta?.helpfulness || 0).toFixed(2),
      topic_clarity_avg: +parseFloat(topicData.__meta?.clarity || 0).toFixed(2),
      topic_confidence_gain: `${Math.round(topicData.__meta?.confidence || 0)}%`,
      topic_engagement_yn: `${Math.round(topicData.__meta?.engagement_yn || 0)}%`,
      topic_pace_stats: topicData.__meta?.pace_trend || {},
    };
  })

    };
  }),

    };
  }
);



    // 5. Return all data
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
        no_of_flag_warning: flagged,
        text_feedback: groupedFeedbackArray,
      },
    });
  } catch (err) {
    console.error("❌ Lifetime feedback fetch failed:", err);
    return res.status(500).json({ success: false, message: "SERVER_ERROR" });
  }
};
