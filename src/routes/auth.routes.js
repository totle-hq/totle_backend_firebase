import express from "express";
import { getUserCount, getUserProfile, loginUser, logout, otpVerification, resetPassword, resetUser, sendContactEmail, signupUserAndSendOtp, updateUserProfile, upload, verifyToken } from "../controllers/auth.controller.js";
import { loginLimiter, signupLimiter } from "../middlewares/rateLimiter.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();
/**
 * ✅ Google Login - Verify Firebase Token & Generate Backend JWT
 */
router.post("/verify-token", verifyToken);

/**
 * ✅ Step 1: Send OTP for Signup (Email or Mobile)
 */
router.post("/signup", signupUserAndSendOtp);

/**
 * ✅ Step 2: Verify OTP & Create Account
 */
router.post("/signup/verifyOtp", otpVerification);

// router.post("/signup/complete", completeSignup);

/**
 * ✅ Secure Login with Email/Mobile & Password
 */
router.post("/login", loginUser);

router.post('/resetUser', resetUser);
router.post('/resetPassword', resetPassword)
router.post('/verifyOtp', otpVerification);
router.get('/user',authMiddleware, getUserProfile);
router.post("/logout", logout);
router.get("/user-count", getUserCount);
router.post("/contactus",sendContactEmail)

router.put("/updateUser", upload.single('image'), updateUserProfile)
// router.get("/:userId", getUserById);
// router.put("/:userId", updateUser);

export default router;
