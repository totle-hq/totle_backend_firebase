import jwt from "jsonwebtoken";
import { User } from "../../Models/UserModels/UserModel.js";
import { BookedSession } from "../../Models/BookedSession.js";
import dotenv from "dotenv";
dotenv.config();

export const getSessionStreamDetails = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { id } = req.user;

    const userRecord = await User.findOne({
      where: { id },
      attributes: ["id", "firstName", "lastName", "email"],
    });

    if (!userRecord) {
      return res.status(404).json({ error: "User not found" });
    }

    const fullName = `${userRecord.firstName} ${userRecord.lastName}`;

    const learner = await BookedSession.findOne({ where: { learner_id: id, id: sessionId } });
    const teacher = await BookedSession.findOne({ where: { teacher_id: id, id: sessionId } });

    if (!learner && !teacher) {
      return res.status(403).json({ error: "You are not authorized to join this session" });
    }

    const role = learner ? "learner" : "teacher";

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
