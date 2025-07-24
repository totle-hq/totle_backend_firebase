import { Session } from "../../Models/SessionModel.js";
import { User } from "../../Models/UserModels/UserModel.js";
import { CatalogueNode } from "../../Models/CatalogModels/catalogueNode.model.js";

export const getStudentSessions = async (req, res) => {
  try {
    const { id } = req.user;

    if (!id) {
      return res.status(400).json({ error: true, message: "Learner ID is required" });
    }

    const sessions = await Session.findAll({
      where: {
        student_id: id,
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

export const getFirstUpcomingTeacherSession = async (req, res) => {
  try {
    const { id } = req.user;

    if (!id) {
      return res.status(400).json({ error: true, message: "Teacher ID is required" });
    }

    const session = await Session.findOne({
      where: {
        teacher_id: id,
        status: "upcoming"
      },
      include: [
        { model: User, as: "student", attributes: ["firstName", "lastName"] },
        { model: CatalogueNode, as: "topic", attributes: ["name"] }
      ],
      order: [["scheduled_at", "ASC"]],
    });

    if (!session) {
      return res.status(404).json({ error: true, message: "No upcoming session found" });
    }

    return res.status(200).json({
      success: true,
      session: {
        session_id: session.id,
        studentName: session.student
          ? `${session.student.firstName} ${session.student.lastName}`
          : "Unknown",
        topicName: session.topic?.name || "Unknown",
        scheduled_at: session.scheduled_at,
      }
    });

  } catch (err) {
    console.error("❌ Error in getFirstUpcomingTeacherSession:", err);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
};


export const getRemainingUpcomingTeacherSessions = async (req, res) => {
  try {
    const { id } = req.user;

    if (!id) {
      return res.status(400).json({ error: true, message: "Teacher ID is required" });
    }

    const sessions = await Session.findAll({
      where: {
        teacher_id: id,
        status: "upcoming"
      },
      include: [
        { model: User, as: "student", attributes: ["firstName", "lastName"] },
        { model: CatalogueNode, as: "topic", attributes: ["name"] }
      ],
      order: [["scheduled_at", "ASC"]],
    });

    if (sessions.length <= 1) {
      return res.status(200).json({ success: true, sessions: [] }); // no remaining
    }

    const remaining = sessions.slice(1).map(session => ({
      session_id: session.id,
      studentName: session.student
        ? `${session.student.firstName} ${session.student.lastName}`
        : "Unknown",
      topicName: session.topic?.name || "Unknown",
      scheduled_at: session.scheduled_at,
    }));

    return res.status(200).json({ success: true, sessions: remaining });

  } catch (err) {
    console.error("❌ Error in getRemainingUpcomingTeacherSessions:", err);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
};
