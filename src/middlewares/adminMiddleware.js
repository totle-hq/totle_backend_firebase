// import jwt from "jsonwebtoken";
// import dotenv from "dotenv";
// dotenv.config();

// // Middleware to authenticate admin
// export const authenticateAdmin = (req, res, next) => {
//   try {
//     const token = req.header("Authorization")?.replace("Bearer ", "");
//     if (!token) return res.status(401).json({ message: "Unauthorized" });

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.admin = decoded; // Store admin data for further use
//     next();
//   } catch (error) {
//     res.status(401).json({ message: "Invalid token" });
//   }
// };

import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

// Middleware to authenticate admin using HttpOnly cookie
export const authenticateAdmin = (req, res, next) => {
  const token = req.cookies?.totle_at;

  if (!token) {
    return res.status(401).json({
      message: "No access token cookie",
      error: "ACCESS_TOKEN_MISSING",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded?.id || decoded.role !== "admin") {
      return res.status(401).json({
        message: "Invalid token payload",
        error: "ACCESS_TOKEN_INVALID",
      });
    }

    req.admin = decoded; // Attach full decoded token (including id, role, etc.)
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Token verification failed",
      error: "ACCESS_TOKEN_INVALID",
    });
  }
};
