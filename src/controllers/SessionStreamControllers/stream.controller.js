import jwt from "jsonwebtoken";
import { User } from "../../Models/UserModels/UserModel.js";
import { BookedSession } from "../../Models/BookedSession.js";
import { StreamChat } from "stream-chat";
import dotenv from "dotenv";
dotenv.config();

// console.log("🔐 STREAM_SECRET:", process.env.STREAM_API_SECRET);

const serverClient = StreamChat.getInstance(
  process.env.STREAM_API_KEY,
  process.env.STREAM_API_SECRET
);

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

    const token = serverClient.createToken(userRecord.id);

    return res.json({
      apiKey: process.env.STREAM_API_KEY,
      token,
      user: { id: userRecord.id, name: fullName },
      callId: sessionId,
      role,
    });
  } catch (err) {
    console.error("Stream token error:", err);
    res.status(500).json({ error: "Failed to get Stream session token" });
  }
};
