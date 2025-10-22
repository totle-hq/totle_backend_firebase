import jwt from "jsonwebtoken";
import { User } from "../../Models/UserModels/UserModel.js";
import { SessionAttendance } from "../../Models/SessionAttendance.js";
import dotenv from "dotenv";
import { Session } from "../../Models/SessionModel.js";
import { CatalogueNode } from "../../Models/CatalogModels/catalogueNode.model.js";
dotenv.config();

const streamApiKey = process.env.STREAM_API_KEY;
const streamApiSecret = process.env.STREAM_API_SECRET;

/* ------------------------------------------------------------
   Helper: Generate Stream Video token
------------------------------------------------------------ */
function createStreamVideoToken(userId, secret, expiresInSeconds = 2 * 60 * 60) {
  const payload = {
    user_id: userId, // Stream expects 'user_id'
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };
  const token = jwt.sign(payload, secret);
  console.log(`[StreamController] 🎟️ Token generated for userId=${userId}`);
  return token;
}

/* ------------------------------------------------------------
   Controller: getSessionStreamDetails
------------------------------------------------------------ */
export const getSessionStreamDetails = async (req, res) => {
  console.groupCollapsed(`[StreamController] ▶ getSessionStreamDetails INIT`);
  try {
    const { sessionId } = req.params;
    const { id } = req.user;

    console.log(`[StreamController] 📨 Incoming request`);
    console.log(`- sessionId: ${sessionId}`);
    console.log(`- userId (from token): ${id}`);
    console.log(`- STREAM_API_KEY present: ${!!streamApiKey}`);
    console.log(`- STREAM_API_SECRET present: ${!!streamApiSecret}`);

    /* ---------------------- Validate user ---------------------- */
    const userRecord = await User.findOne({
      where: { id },
      attributes: ["id", "firstName", "lastName", "email"],
    });

    if (!userRecord) {
      console.error("[StreamController] ❌ User not found:", id);
      console.groupEnd();
      return res.status(404).json({ error: "User not found" });
    }

    const fullName = `${userRecord.firstName} ${userRecord.lastName}`;
    console.log(`[StreamController] 👤 User found: ${fullName} (${userRecord.email})`);

    /* ---------------------- Get session ---------------------- */
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
      console.error("[StreamController] ❌ Session not found:", sessionId);
      console.groupEnd();
      return res.status(404).json({ error: "Session not found" });
    }

    console.log(`[StreamController] 📚 Session record found for ID=${sessionId}`);
    console.log(`- Teacher ID: ${session.teacher_id}`);
    console.log(`- Student ID: ${session.student_id}`);
    console.log(`- Scheduled at: ${session.scheduled_at}`);

    /* ---------------------- Authorization ---------------------- */
    if (session.teacher_id !== id && session.student_id !== id) {
      console.warn(
        `[StreamController] ⚠️ Unauthorized access attempt by user ${id} for session ${sessionId}`
      );
      console.groupEnd();
      return res.status(403).json({ error: "You are not authorized to join this session" });
    }

    const role = session.student_id === id ? "learner" : "teacher";
    console.log(`[StreamController] 🧭 User role identified: ${role}`);

    /* ---------------------- Mark attendance ---------------------- */
    try {
      await SessionAttendance.upsert({
        user_id: id,
        session_id: sessionId,
        joined_at: new Date(),
      });
      console.log(`[StreamController] 🕒 Attendance marked for user=${id}, session=${sessionId}`);
    } catch (attendanceErr) {
      console.error(
        "[StreamController] ⚠️ Failed to mark attendance:",
        attendanceErr.message
      );
    }

    /* ---------------------- Token Generation ---------------------- */
    if (!streamApiSecret) {
      console.error("[StreamController] ❌ Missing STREAM_API_SECRET in env");
      console.groupEnd();
      return res.status(500).json({ error: "Server misconfigured (missing Stream secret)" });
    }

    const streamToken = createStreamVideoToken(id, streamApiSecret);

/* ---------------------- Response ---------------------- */
const persistentCallId = `totle-${session.session_id}`; // ✅ shared callId for all participants

const responsePayload = {
  success: true,
  callId: persistentCallId,              // <-- FIXED
  userName: fullName,
  userRole: role,
  apiKey: streamApiKey,
  token: streamToken,
  user: { id: id.toString(), name: fullName },
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
};


    console.log(`[StreamController] ✅ Returning session details to frontend`);
    console.log(responsePayload);

    console.groupEnd();
    return res.status(200).json(responsePayload);
  } catch (err) {
    console.groupEnd();
    console.error("[StreamController] ❌ Stream Video session init error:", err);
    return res
      .status(500)
      .json({ error: "Failed to get Stream session details", details: err.message });
  }
};
