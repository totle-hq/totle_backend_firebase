import admin from "../config/firebase.js";

const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(403).json({ message: "❌ No token provided" });
  }

  try {
    // ✅ Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken; // Attach user info to request
    next(); // Continue to the next middleware or route
  } catch (error) {
    console.error("❌ Firebase Authentication Error:", error);
    res.status(401).json({ message: "❌ Invalid Token", error: error.message });
  }
};

export default authMiddleware;
