import { StreamVideoServerClient } from '@stream-io/video-node-sdk';

const streamClient = new StreamVideoServerClient({
  apiKey: process.env.STREAM_API_KEY,
  secret: process.env.STREAM_API_SECRET,
});

export const getSessionStreamDetails = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const user = {
      id: req.user.id,
      name: req.user.name,
    };
    const role = req.user.role || 'learner';

    const call = streamClient.call("default", sessionId);
    const token = call.getToken(user.id);

    res.json({
      apiKey: process.env.STREAM_API_KEY,
      token,
      user,
      callId: sessionId,
      role,
    });
  } catch (err) {
    console.error("Stream session error:", err);
    res.status(500).json({ error: "Unable to fetch session details" });
  }
};
