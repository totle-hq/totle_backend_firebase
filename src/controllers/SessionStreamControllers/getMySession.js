import { Session } from "../../Models/SessionModel.js";
import { User } from "../../Models/UserModels/UserModel.js";
import { CatalogueNode } from "../../Models/CatalogModels/catalogueNode.model.js";
import { BookedSession } from "../../Models/BookedSession.js";

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

    const session = await BookedSession.findOne({
      where: {
        teacher_id: id,
      },
      include: [
        { model: User, as: "student", attributes: ["firstName", "lastName"] },
        { model: CatalogueNode, as: "topicName", attributes: ["name"] }
      ],
      order: [["createdAt", "ASC"]],
    });
    
    if (!session) {
      console.warn("⚠️ No upcoming session found for this teacher");
      return res.status(404).json({ error: true, message: "No upcoming session found" });
    }

    let learner = await User.findOne({
      where: { id: session.learner_id },
      attributes: ['firstName', 'lastName']
    });

    let topic = await CatalogueNode.findOne({
      where: { node_id: session.topic_id },
      attributes: ['name']
    });

    return res.status(200).json({
      success: true,
      session: {
        session_id: session.id,
        studentName: session.learner_id
          ? `${learner.firstName} ${learner.lastName}`
          : "Unknown",
        topicName: topic.name || "Unknown",
        scheduled_at: session.createdAt,
      }
    });

  } catch (err) {
    console.error("❌ Error in getFirstUpcomingTeacherSession:", err);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
};


export const getAllUpcomingTeacherSessions = async (req, res) => {
  try {
    const { id } = req.user;

    if (!id) {
      return res.status(400).json({ error: true, message: "Teacher ID is required" });
    }

    const sessions = await BookedSession.findAll({
      where: { teacher_id: id },
      include: [
        {
          model: User,
          as: "student",
          attributes: ["firstName", "lastName"]
        },
        {
          model: CatalogueNode,
          as: "bookedTopic",
          attributes: ["name", "parent_id"],
          include: [
            {
              model: CatalogueNode,
              as: "subject",
              attributes: ["name"]
            }
          ]
        }
      ],
      order: [["createdAt", "ASC"]],
    });


    const formatted = sessions.map(session => ({
      session_id: session.id,
      studentName: session.student
        ? `${session.student.firstName} ${session.student.lastName}`
        : "Unknown",
      topicName: session.bookedTopic?.name || "Unknown",
      subject: session.bookedTopic?.subject?.name || "No Subject",
      scheduled_at: session.createdAt,
    }));

    return res.status(200).json({ success: true, sessions: formatted });

  } catch (err) {
    console.error("❌ Error in getAllUpcomingTeacherSessions:", err);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
};
