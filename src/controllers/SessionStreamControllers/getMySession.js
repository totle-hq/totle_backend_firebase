import { Session } from "../../Models/SessionModel.js";
import { User } from "../../Models/UserModels/UserModel.js";
import { CatalogueNode } from "../../Models/CatalogModels/catalogueNode.model.js";
// import { BookedSession } from "../../Models/BookedSession.js";
import { literal, Op } from "sequelize";
import Feedback from "../../Models/feedbackModels.js";

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
        ...upcomingOrOngoingFilter()
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
        scheduled_at: session.scheduled_at,
        teacherName: `${session.teacher.firstName} ${session.teacher.lastName||""}`,
        topicName: session.topic.name,
        subject: session.topic.subject?.name,
        teacher_level: session.session_level,
        duration: session.duration_minutes
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
        status: "upcoming",
        ...upcomingOrOngoingFilter()
      },

      include: [
        { model: User, as: "teacher", attributes: ["firstName", "lastName"] },
        { model: CatalogueNode, as: "topic", attributes: ["name"] },
        { model: Feedback, as: "feedbacks", required: false },
      ],
      order: [["scheduled_at", "ASC"]],
    });

    const formatted = sessions.map(session => ({
      session_id: session.session_id,
      teacherName: `${session.teacher.firstName} ${session.teacher.lastName}`,
      topicName: session.topic.name,
      scheduled_at: session.scheduled_at.toISOString(),
      feedbackSubmitted: session.feedbacks?.length > 0,
    }));
    
    console.log("sessions:", formatted);
    
    return res.status(200).json({ success: true, sessions: formatted });

  } catch (err) {
    console.error("❌ Error in getMySessions:", err);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
};

export const getFirstUpcomingTeacherSession = async (req, res) => {
  try {
    const { id } = req.user;
    if (!id) return res.status(400).json({ error: true, message: "Teacher ID is required" });

    const now = new Date();

    const session = await Session.findOne({
      where: {
        teacher_id: id,
        status: { [Op.in]: ["upcoming", "booked"] },
        ...upcomingOrOngoingFilter()

      },
      include: [
        { model: User, as: "student", attributes: ["firstName", "lastName"] },
        {
          model: CatalogueNode,
          as: "topic",
          attributes: ["name", "parent_id"],
          include: [{ model: CatalogueNode, as: "subject", attributes: ["name"] }],
        },
      ],
      order: [["scheduled_at", "ASC"]],
    });

    if (!session)
      return res.status(404).json({ error: true, message: "No upcoming session found" });

    return res.status(200).json({
      success: true,
      session: {
        session_id: session.session_id,
        studentName: session.student
          ? `${session.student.firstName} ${session.student.lastName || ""}`
          : "Unknown",
        topicName: session.topic?.name || "Unknown",
        subject: session.topic?.subject?.name || "Unknown",
        scheduled_at: session.scheduled_at,
      },
    });
  } catch (err) {
    console.error("❌ Error in getFirstUpcomingTeacherSession:", err);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
};

export const getAllUpcomingTeacherSessions = async (req, res) => {
  try {
    const { id } = req.user; // teacher id from JWT
    if (!id) {
      return res.status(400).json({ error: true, message: "Teacher ID is required" });
    }

    const now = new Date();

    const sessions = await Session.findAll({
      where: {
        teacher_id: id,
        status: { [Op.in]: ["upcoming", "booked"] },
        ...upcomingOrOngoingFilter()
      },
      include: [
        {
          model: User,
          as: "student",
          attributes: ["firstName", "lastName"],
        },
        {
          model: CatalogueNode,
          as: "topic",
          attributes: ["name", "parent_id"],
          include: [
            {
              model: CatalogueNode,
              as: "subject",
              attributes: ["name"],
            },
          ],
        },
      ],
      order: [["scheduled_at", "ASC"]],
    });

    if (!sessions.length) {
      return res.status(200).json({ success: true, sessions: [] });
    }

    const formatted = sessions.map((s) => ({
      session_id: s.session_id,
      studentName: s.student ? `${s.student.firstName}`.trim() : "Unassigned",
      topicName: s.topic?.name || "Unknown",
      subject: s.topic?.subject?.name || "Unknown",
      scheduled_at: s.scheduled_at,
    }));

    return res.status(200).json({ success: true, sessions: formatted });
  } catch (err) {
    console.error("❌ Error in getAllUpcomingTeacherSessions:", err);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
};


export const upcomingOrOngoingFilter = () => ({
  [Op.or]: [
    { scheduled_at: { [Op.gte]: new Date() } },
    {
      [Op.and]: literal(`scheduled_at + (duration_minutes || ' minutes')::interval >= NOW()`)
    }
  ]
});