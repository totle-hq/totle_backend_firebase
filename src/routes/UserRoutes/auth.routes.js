import express from "express";
import { getUserCount, getUserProfile, loginUser, logout, otpVerification, resetPassword ,getAllBetaUsers, resetUser, sendContactEmail, signupUserAndSendOtp, updateUserProfile, verifyToken, submitSuggestion, verifyResetOtp, getWelcome, updateWelcome, getUpdates, getBetaUserProfile ,updateProfileMeta} from "../../controllers/UserControllers/auth.controller.js";
import upload from "../../middlewares/multer.js";
import { loginLimiter, signupLimiter } from "../../middlewares/rateLimiter.js";
import authMiddleware from "../../middlewares/authMiddleware.js";
import { SupportQueryForUser } from "../../controllers/SupportQueriesController/SupportQueryController.js";

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
router.post("/profile/meta", updateProfileMeta);
router.post("/logout", logout);
router.get("/user-count", getUserCount);
router.post("/contactus",sendContactEmail)
router.post("/suggestion",submitSuggestion)
router.post('/verifyResetOtp', verifyResetOtp);
router.get("/welcomeScreen", getWelcome)
router.post("/update-welcome", updateWelcome);
router.post("/getUpdates", getUpdates)
router.get("/users/is-beta", getBetaUserProfile);
router.get("/allBetaUsers",getAllBetaUsers);

router.put("/user/updateUser", upload.single("dp"), updateUserProfile)
// router.get("/:userId", getUserById);
// router.put("/:userId", updateUser);
router.post("/query",SupportQueryForUser);

export default router;
