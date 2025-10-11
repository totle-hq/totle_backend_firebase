import jwt from "jsonwebtoken";
import { User } from "../../Models/UserModels/UserModel.js";
import { BookedSession } from "../../Models/BookedSession.js";
import { SessionAttendance } from "../../Models/SessionAttendance.js";
import dotenv from "dotenv";
import { Session } from "../../Models/SessionModel.js";
import { CatalogueNode } from "../../Models/CatalogModels/catalogueNode.model.js";
dotenv.config();

export const getSessionStreamDetails = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { id } = req.user;

    console.log("🔍 Fetching session stream details for sessionId:", sessionId, "and userId:", id);

    const userRecord = await User.findOne({
      where: { id },
      attributes: ["id", "firstName", "lastName", "email"],
    });

    if (!userRecord) {
      return res.status(404).json({ error: "User not found" });
    }

    const fullName = `${userRecord.firstName} ${userRecord.lastName}`;

    // Include teacher, student, topic, and parentNode (subject)
    const session = await Session.findOne({
      where: { session_id: sessionId },
      include: [
        { model: User, as: "teacher", attributes: ["id", "firstName", "lastName", "email"] },
        { model: User, as: "student", attributes: ["id", "firstName", "lastName", "email"] },
        {
          model: CatalogueNode,
          as: "catalogueNode",
          attributes: ["node_id", "name", "parent_id"],
          include: [
            {
              model: CatalogueNode,
              as: "parentNode",
              attributes: ["node_id", "name"],
            },
          ],
        },
      ],
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Validate access (must be either teacher or student)
    if (session.teacher_id !== id && session.student_id !== id) {
      return res.status(403).json({ error: "You are not authorized to join this session" });
    }

    const role = session.student_id === id ? "learner" : "teacher";

    // ✅ Mark attendance
    await SessionAttendance.upsert({
      user_id: id,
      session_id: sessionId,
      joined_at: new Date(),
    });

    // 🔐 JWT token for WebSocket authentication
    const socketToken = jwt.sign(
      {
        userId: userRecord.id,
        name: fullName,
        sessionId,
        role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    // ✅ Build clean structured response
    return res.status(200).json({
      success: true,
      session: {
        session_id: session.session_id,
        teacher: session.teacher
          ? `${session.teacher.firstName} ${session.teacher.lastName}`
          : "Unknown",
        student: session.student
          ? `${session.student.firstName} ${session.student.lastName}`
          : "Unknown",
        topic: session.catalogueNode?.name || "Unknown",
        subject: session.catalogueNode?.parentNode?.name || "Unknown",
        scheduled_at: session.scheduled_at,
      },
      role,
      token: socketToken,
      user: { id: userRecord.id, name: fullName },
    });
  } catch (err) {
    console.error("❌ WebRTC session init error:", err);
    res.status(500).json({ error: "Failed to get WebRTC session details" });
  }
};

