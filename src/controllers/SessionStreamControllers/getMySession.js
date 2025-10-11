import { Session } from "../../Models/SessionModel.js";
import { User } from "../../Models/UserModels/UserModel.js";
import { CatalogueNode } from "../../Models/CatalogModels/catalogueNode.model.js";
import { BookedSession } from "../../Models/BookedSession.js";
import { Op } from "sequelize";

// controllers/session.controller.js
export const getFirstUpcomingStudentSession = async (req, res) => {
  try {
    const {id} = req.user; // ID from JWT middleware

    console.log("🔍 Fetching first upcoming session for student ID:", id);
    if (!id) {
      return res.status(400).json({ error: true, message: "Student ID missing" });
    }

    const now = new Date();

    const session = await Session.findOne({
      where: {
        student_id: id,
        createdAt: { [Op.gt]: now }
      },
      include: [
        { model: User, as: "teacher", attributes: ["firstName", "lastName"] },
        {
          model: CatalogueNode,
          as: "topic",
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

    if (!session) {
      console.warn("⚠️ No upcoming session found for this student");
      return res.status(404).json({ error: true, message: "No upcoming session found" });
    }

    return res.status(200).json({
      success: true,
      session: {
        session_id: session.session_id,
        scheduled_at: session.createdAt,
        teacherName: `${session.teacher.firstName} ${session.teacher.lastName||""}`,
        topicName: session.bookedTopic.name,
        subject: session.bookedTopic.subject?.name
      }
    });

  } catch (error) {
    console.error("❌ Error fetching student session:", error);
    return res.status(500).json({ error: true, message: "Internal Server Error" });
  }
};



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
      session_id: session.session_id,
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
      },
      include: [
        { model: User, as: "student", attributes: ["firstName", "lastName"] },
        {
          model: CatalogueNode,
          as: "topic",
          attributes: ["node_id", "name", "parent_id"],
          include: [
            {
              model: CatalogueNode,
              as: "parentNode",   // 👈 this is the subject
              attributes: ["node_id", "name", "parent_id"],
            }
          ]
        }
      ],
      order: [["createdAt", "ASC"]],
    });
    
    if (!session) {
      console.warn("⚠️ No upcoming session found for this teacher");
      return res.status(404).json({ error: true, message: "No upcoming session found" });
    }

    // let topic = await CatalogueNode.findOne({where: {node_id: session.topic_id}})

    return res.status(200).json({
      success: true,
      session: {
        session_id: session.session_id,
        studentName: session.learner_id
          ? `${session.student.firstName}`
          : "Unknown",
        topicName: session.bookedTopic?.name || "Unknown",
        subject: session.bookedTopic?.parentNode?.name || "Unknown",
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

    const sessions = await Session.findAll({
      where: { teacher_id: id },
      include: [
        {
          model: User,
          as: "student",
          attributes: ["firstName", "lastName"]
        },
        {
          model: CatalogueNode,
          as: "topic",
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
      topicName: session.topic?.name || "Unknown",
      subject: session.topic?.subject?.name || "No Subject",
      scheduled_at: session.createdAt,
    }));

    return res.status(200).json({ success: true, sessions: formatted });

  } catch (err) {
    console.error("❌ Error in getAllUpcomingTeacherSessions:", err);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
};
