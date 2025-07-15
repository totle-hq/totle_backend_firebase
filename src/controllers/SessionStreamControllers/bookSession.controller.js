// controller/bookedSession.js

import { BookedSession } from "../../Models/BookedSession.js";
import { Session } from "../../Models/SessionModel.js";
import { User } from "../../Models/UserModels/UserModel.js";
import { sequelize1 } from "../../config/sequelize.js";
import { Op } from "sequelize";
import moment from "moment";

function calculateAge(dob) {
  return moment().diff(moment(dob), "years");
}

function getMatchScore(learner, teacher) {
  let score = 0;

  const learnerLangs = learner.known_language_ids || [];
  if (
    teacher.preferred_language_id &&
    learnerLangs.includes(teacher.preferred_language_id)
  ) {
    score += 4;
  }

  if (
    learner.ipAddress &&
    teacher.ipAddress &&
    learner.ipAddress.split(".")[0] === teacher.ipAddress.split(".")[0]
  ) {
    score += 3;
  }

  const learnerAge = calculateAge(learner.dob);
  const teacherAge = calculateAge(teacher.dob);
  if (learnerAge && teacherAge && Math.abs(learnerAge - teacherAge) <= 5) {
    score += 3;
  }

  return score;
}
export const bookFreeSession = async (req, res) => {
  console.log("🔥 Hit bookFreeSession API");
  console.log("👉 learner_id from token:", req.user?.id);
  console.log("👉 topic_id from body:", req.body.topic_id);

  try {
    const learner_id = req.user?.id;
    const { topic_id } = req.body;

    if (!learner_id || !topic_id) {
      return res.status(400).json({
        error: true,
        message: "Learner ID and Topic ID are required",
      });
    }

    const learner = await User.findOne({ where: { id: learner_id } });
    if (!learner) {
      return res.status(404).json({
        error: true,
        message: "Learner not found",
      });
    }

    const availableSessions = await Session.findAll({
      where: { topic_id, status: "available" },
    });

    if (availableSessions.length === 0) {
      return res.status(404).json({
        error: true,
        message: "No available teacher sessions found for this topic",
      });
    }

    // 🧠 Matching logic
    let bestScore = -1;
    let selectedSession = null;

    for (const session of availableSessions) {
      const teacher = await User.findOne({ where: { id: session.teacher_id } });
      const score = getMatchScore(learner, teacher);
      if (score > bestScore) {
        bestScore = score;
        selectedSession = session;
      }
    }

    // Save booking
    await BookedSession.create({ learner_id, topic_id });
    console.log("✅ Booking DB Save:", { learner_id, topic_id });

    // Update session
    await Session.update(
      { student_id: learner_id, status: "upcoming" },
      { where: { id: selectedSession.id } }
    );

    // 🔍 Fetch teacher name
    const teacher = await User.findOne({
      where: { id: selectedSession.teacher_id },
      attributes: ['firstName', 'lastName']
    });

    // 🔍 Fetch topic name
    const { CatalogueNode } = await import("../../Models/CatalogModels/catalogueNode.model.js");
    const topic = await CatalogueNode.findOne({
      where: { node_id: topic_id },
      attributes: ['name']
    });

    return res.status(200).json({
      success: true,
      message: "Session booked successfully",
      data: {
        sessionId: selectedSession.id,
        teacherName: `${teacher.firstName} ${teacher.lastName}`,
        topicName: topic?.name || "Unknown",
        scheduledAt: selectedSession.scheduled_at,
      }
    });

  } catch (err) {
    console.error("❌ Error booking session:", err);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
};


/*export const bookFreeSession = async (req, res) => {
  console.log("🔥 Hit bookFreeSession API");
  console.log("👉 learner_id from token:", req.user?.id);
  console.log("👉 topic_id from body:", req.body.topic_id);

  try {
    const learner_id = req.user?.id;
    const { topic_id } = req.body;

    if (!learner_id || !topic_id) {
      return res.status(400).json({
        error: true,
        message: "Learner ID and Topic ID are required",
      });
    }

    const learner = await User.findOne({ where: { id: learner_id } });
    if (!learner) {
      return res.status(404).json({
        error: true,
        message: "Learner not found",
      });
    }

    const availableSessions = await Session.findAll({
      where: { topic_id, status: "available" },
    });

    if (availableSessions.length === 0) {
      return res.status(404).json({
        error: true,
        message: "No available teacher sessions found for this topic",
      });
    }

    // 🧠 Matching logic
    let bestScore = -1;
    let selectedSession = null;

    for (const session of availableSessions) {
      const teacher = await User.findOne({ where: { id: session.teacher_id } });
      const score = getMatchScore(learner, teacher);
      if (score > bestScore) {
        bestScore = score;
        selectedSession = session;
      }
    }

    // Save booking
    await BookedSession.create({ learner_id, topic_id });
    console.log("✅ Booking DB Save:", { learner_id, topic_id });

    // Update session
    await Session.update(
      { student_id: learner_id, status: "upcoming" },
      { where: { id: selectedSession.id } }
    );

    // 🔍 Fetch teacher name
    const teacher = await User.findOne({
      where: { id: selectedSession.teacher_id },
      attributes: ['firstName', 'lastName']
    });

    // 🔍 Fetch topic name
    const { CatalogueNode } = await import("../../Models/CatalogModels/catalogueNode.model.js");
    const topic = await CatalogueNode.findOne({
      where: { node_id: topic_id },
      attributes: ['name']
    });

    return res.status(200).json({
      success: true,
      message: "Session booked successfully",
      data: {
        teacherName: `${teacher.firstName} ${teacher.lastName}`,
        topicName: topic?.name || "Unknown",
        scheduledAt: selectedSession.scheduled_at,
      }
    });

  } catch (err) {
    console.error("❌ Error booking session:", err);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
};
*/

