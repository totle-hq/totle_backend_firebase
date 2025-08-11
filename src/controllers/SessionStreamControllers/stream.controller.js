import jwt from "jsonwebtoken";
import { User } from "../../Models/UserModels/UserModel.js";
import { BookedSession } from "../../Models/BookedSession.js";
import { SessionAttendance } from "../../Models/SessionAttendance.js";
import dotenv from "dotenv";
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

    // console.log("userRecord:", userRecord);
    if (!userRecord) {
      return res.status(404).json({ error: "User not found" });
    }

    const fullName = `${userRecord.firstName} ${userRecord.lastName}`;

    const learner = await BookedSession.findOne({ where: { learner_id: id, session_id: sessionId } });
    console.log("learner:", learner);
    const teacher = await BookedSession.findOne({ where: { teacher_id: id, session_id: sessionId } });
    console.log("teacher:", teacher);

    if (!learner && !teacher) {
      return res.status(403).json({ error: "You are not authorized to join this session" });
    }

    const role = learner ? "learner" : "teacher";

     //  marking present with joining time;
    await SessionAttendance.upsert({
      user_id: id,
      session_id: sessionId,
      joined_at: new Date(),    
    });
    
    // Create JWT token for WebSocket auth (optional)
    const socketToken = jwt.sign(
      { userId: userRecord.id, name: fullName, sessionId, role },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    return res.status(200).json({
      sessionId,
      token: socketToken,
      user: { id: userRecord.id, name: fullName },
      role,
    });
  } catch (err) {
    console.error("❌ WebRTC session init error:", err);
    res.status(500).json({ error: "Failed to get WebRTC session details" });
  }
};
