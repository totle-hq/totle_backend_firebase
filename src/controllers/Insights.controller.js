import { Session } from "../Models/SessionModel.js";
import  Feedback  from "../Models/feedbackModels.js";
import { CatalogueNode } from "../Models/CatalogModels/catalogueNode.model.js";
import { Op } from "sequelize";

export const getInsights = async (req, res) => {
  try {
    const teacherId = req.user_id;

    if (!teacherId) {
      return res.status(401).json({ message: "No insights found" });
    }

    const sessions = await Session.findAll({
      where: { teacher_id: teacherId },
      include: [
        {
          model: CatalogueNode,
          as: "topic",
          include: [
            {
              model: CatalogueNode,
              as: "parent", // Subject
              include: {
                model: CatalogueNode,
                as: "parent", // Domain
              },
            },
          ],
        },
      ],
    });

    const sessionIds = sessions.map((s) => s.id);
    const feedbacks = await Feedback.findAll({
      where: { session_id: { [Op.in]: sessionIds } },
    });

    const feedbackMap = {};
    feedbacks.forEach((f) => {
      if (!feedbackMap[f.session_id]) {
        feedbackMap[f.session_id] = [];
      }
      feedbackMap[f.session_id].push(f.rating);
    });

    const hierarchyMap = {};

    for (const session of sessions) {
      const topic = session.topic;
      if (!topic) continue;

      const subject = topic.parent;
      const domain = subject?.parent;

      const domainName = domain?.name || "Unknown Domain";
      const subjectName = subject?.name || "Unknown Subject";
      const topicName = topic.name;

      if (!hierarchyMap[domainName]) {
        hierarchyMap[domainName] = {};
      }

      if (!hierarchyMap[domainName][subjectName]) {
        hierarchyMap[domainName][subjectName] = {};
      }

      if (!hierarchyMap[domainName][subjectName][topicName]) {
        hierarchyMap[domainName][subjectName][topicName] = {
          topic: topicName,
          finished_sessions: 0,
          active_bookings: 0,
          total_rating: 0,
          rating_count: 0,
        };
      }

      const stats = hierarchyMap[domainName][subjectName][topicName];

      if (session.status === "completed") {
        stats.finished_sessions++;
        const ratings = feedbackMap[session.id] || [];
        ratings.forEach((r) => {
          stats.total_rating += r;
          stats.rating_count++;
        });
      } else if (session.status === "available") {
        stats.active_bookings++;
      }
    }

    // Final formatting
    const finalData = Object.entries(hierarchyMap).map(([domainName, subjects]) => ({
      domain: domainName,
      subjects: Object.entries(subjects).map(([subjectName, topics]) => ({
        subject: subjectName,
        topics: Object.values(topics).map((t) => ({
          ...t,
          average_rating: t.rating_count === 0 ? 0 : parseFloat((t.total_rating / t.rating_count).toFixed(2)),
        })),
      })),
    }));

    res.status(200).json({ data: finalData });
  } catch (error) {
    console.error("❌ Error in getInsights:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

