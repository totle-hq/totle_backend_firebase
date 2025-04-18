import jwt from "jsonwebtoken";

export const getSessionStreamDetails = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const user = {
      id: req.user.id,
      name: req.user.name,
    };

    const token = jwt.sign(
      { user_id: user.id },
      process.env.STREAM_API_SECRET,
      { algorithm: "HS256", expiresIn: "2h" }
    );

    return res.json({
      apiKey: process.env.STREAM_API_KEY,
      token,
      user,
      callId: sessionId,
      role: req.user.role || "learner",
    });
  } catch (err) {
    console.error("Stream token error:", err);
    res.status(500).json({ error: "Failed to get Stream session token" });
  }
};
