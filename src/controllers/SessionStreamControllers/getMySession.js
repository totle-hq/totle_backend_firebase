import { Session } from "../../Models/SessionModel.js";
import { User } from "../../Models/UserModels/UserModel.js";
import { CatalogueNode } from "../../Models/CatalogModels/catalogueNode.model.js";

export const getMySessions = async (req, res) => {
  try {
    const { learner_id } = req.query;

    if (!learner_id) {
      return res.status(400).json({ error: true, message: "Learner ID is required" });
    }

    const sessions = await Session.findAll({
      where: {
        student_id: learner_id,
        status: "upcoming"
      },
      include: [
        { model: User, as: "teacher", attributes: ["firstName", "lastName"] },
        { model: CatalogueNode, as: "topic", attributes: ["name"] }
      ],
      order: [["scheduled_at", "ASC"]],
    });

    const formatted = sessions.map(session => ({
      session_id: session.id,
      teacherName: `${session.teacher.firstName} ${session.teacher.lastName}`,
      topicName: session.topic.name,
      scheduled_at: session.scheduled_at,
    }));

    return res.status(200).json({ success: true, sessions: formatted });

  } catch (err) {
    console.error("❌ Error in getMySessions:", err);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
};
