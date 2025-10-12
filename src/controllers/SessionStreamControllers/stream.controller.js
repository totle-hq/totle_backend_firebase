import jwt from "jsonwebtoken";
import { User } from "../../Models/UserModels/UserModel.js";
import { SessionAttendance } from "../../Models/SessionAttendance.js";
import dotenv from "dotenv";
import { Session } from "../../Models/SessionModel.js";
import { CatalogueNode } from "../../Models/CatalogModels/catalogueNode.model.js";
dotenv.config();

const streamApiKey = process.env.STREAM_API_KEY;
const streamApiSecret = process.env.STREAM_API_SECRET;

function createStreamVideoToken(userId, secret, expiresInSeconds = 2 * 60 * 60) {
  const payload = {
    user_id: userId, // Stream expects 'user_id'
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };
  return jwt.sign(payload, secret);
}

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

    // Get the session
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

    // Mark attendance
    await SessionAttendance.upsert({
      user_id: id,
      session_id: sessionId,
      joined_at: new Date(),
    });

    // --- THIS IS THE IMPORTANT PART ---
    const streamToken = createStreamVideoToken(id, streamApiSecret);

    // Return what the frontend expects
    return res.status(200).json({
      success: true,
      callId: session.session_id,
      userName: fullName,
      userRole: role,
      apiKey: streamApiKey,       // <-- safe for frontend
      token: streamToken,         // <-- your Stream Video token
      user: { id: id.toString(), name: fullName },
      session: {
        session_id: session.session_id,
        teacher: session.teacher ? `${session.teacher.firstName} ${session.teacher.lastName}` : "Unknown",
        student: session.student ? `${session.student.firstName} ${session.student.lastName}` : "Unknown",
        topic: session.catalogueNode?.name || "Unknown",
        subject: session.catalogueNode?.parentNode?.name || "Unknown",
        scheduled_at: session.scheduled_at,
      }
    });
  } catch (err) {
    console.error("❌ Stream Video session init error:", err);
    res.status(500).json({ error: "Failed to get Stream session details" });
  }
};
