import express from "express";
import { getUserCount, getUserProfile, loginUser, logout, otpVerification, resetPassword, resetUser, sendContactEmail, signupUserAndSendOtp, updateUserProfile, upload, verifyToken, submitSuggestion, verifyResetOtp, getWelcome, updateWelcome, getUpdates } from "../../controllers/UserControllers/auth.controller.js";
import { loginLimiter, signupLimiter } from "../../middlewares/rateLimiter.js";
import authMiddleware from "../../middlewares/authMiddleware.js";

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
router.get('/user', getUserProfile);
router.post("/logout", logout);
router.get("/user-count", getUserCount);
router.post("/contactus",sendContactEmail)
router.post("/suggestion",submitSuggestion)
router.post('/verifyResetOtp', verifyResetOtp);
router.get("/welcomeScreen", getWelcome)
router.post("/update-welcome", updateWelcome);
router.post("/getUpdates", getUpdates)


router.put("/updateUser", upload.single('image'), updateUserProfile)
// router.get("/:userId", getUserById);
// router.put("/:userId", updateUser);

export default router;
