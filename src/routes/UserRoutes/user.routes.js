import express from "express";
import authMiddleware from "../../middlewares/authMiddleware.js"; // ✅ Ensure ".js" is included
import { profileSetUp } from "../../controllers/UserControllers/user.controller.js";


const router = express.Router();

// ✅ Secure route using Firebase authentication
router.get("/profile", authMiddleware, profileSetUp);

export default router;
