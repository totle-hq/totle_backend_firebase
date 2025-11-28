import jwt from "jsonwebtoken";

export default function authMiddleware(req, res, next) {
  // Read access token from HttpOnly cookie
  const token = req.cookies?.totle_at;

  if (!token) {
    return res.status(401).json({
      message: "No access token cookie",
      error: "ACCESS_TOKEN_MISSING",
    });
  }

  try {
    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach decoded user to request object
    req.user = decoded;

    next();
  } catch (err) {
    console.error("❌ Token verification failed:", err.message);

    return res.status(401).json({
      message: "tokenExpired",
      error: "ACCESS_TOKEN_INVALID",
    });
  }
}
