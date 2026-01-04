import jwt from "jsonwebtoken";

export default function authMiddleware(req, res, next) {
  const token = req.cookies?.totle_at;

  if (!token) {
    console.log("No token found");
    return res.status(401).json({
      message: "No access token cookie",
      error: "ACCESS_TOKEN_MISSING",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Invalid")
    if (!decoded?.id) {
      return res.status(401).json({
        message: "Invalid token payload",
        error: "ACCESS_TOKEN_INVALID",
      });
    }

    req.user = { id: decoded.id };

    next();
  } catch (err) {
    return res.status(401).json({
      message: "tokenExpired",
      error: "ACCESS_TOKEN_INVALID",
    });
  }
}
