import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

// Middleware to authenticate admin
export const authenticateAdmin = (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded; // Store admin data for further use
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};