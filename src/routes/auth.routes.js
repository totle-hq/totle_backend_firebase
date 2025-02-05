import express from "express";
import admin from "../config/firebase.js"; // ✅ Firebase Admin SDK for Google Login
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/prismaClient.js"; // ✅ Prisma DB Client
import { sendOtp } from "../utils/otpService.js"; // ✅ Utility for OTP sending

const router = express.Router();

/**
 * ✅ Google Login - Verify Firebase Token & Generate Backend JWT
 */
router.post("/verify-token", async (req, res) => {
  const { token } = req.body;

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { uid, email } = decodedToken;

    const backendToken = jwt.sign({ uid, email }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({
      message: "✅ Authentication Successful!",
      backendToken,
      user: { uid, email },
    });
  } catch (error) {
    res.status(401).json({ message: "❌ Invalid Token", error: error.message });
  }
});

/**
 * ✅ Step 1: Send OTP for Signup (Email or Mobile)
 */
router.post("/signup/send-otp", async (req, res) => {
  const { email, mobile } = req.body;

  if (!email && !mobile) {
    return res.status(400).json({ message: "❌ Email or Mobile is required." });
  }

  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // OTP expires in 5 mins

    // ✅ Store OTP in DB
    if (email) {
      await prisma.user.upsert({
        where: { email },
        update: { otpCode: otp, otpExpiresAt },
        create: { email, otpCode: otp, otpExpiresAt },
      });
    } else {
      await prisma.user.upsert({
        where: { mobile },
        update: { otpCode: otp, otpExpiresAt },
        create: { mobile, otpCode: otp, otpExpiresAt },
      });
    }

    // ✅ Send OTP (Email or SMS)
    await sendOtp(email, mobile, otp);

    res.json({ message: "✅ OTP sent successfully!" });
  } catch (error) {
    console.error("Signup OTP Error:", error);
    res.status(500).json({ message: "❌ Error sending OTP.", error: error.message });
  }
});

/**
 * ✅ Step 2: Verify OTP & Create Account
 */
router.post("/signup/verify", async (req, res) => {
  const { email, mobile, otp, username, password } = req.body;

  if (!otp || !password || !username) {
    return res.status(400).json({ message: "❌ OTP, Username, and Password are required." });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { email: email || undefined, mobile: mobile || undefined },
    });

    if (!user || user.otpCode !== otp || new Date() > user.otpExpiresAt) {
      return res.status(400).json({ message: "❌ Invalid or expired OTP." });
    }

    // ✅ Hash password securely
    const passwordHash = await bcrypt.hash(password, 10);

    // ✅ Update user data
    await prisma.user.update({
      where: { id: user.id },
      data: { username, passwordHash, otpCode: null, otpExpiresAt: null },
    });

    res.json({ message: "✅ Account created successfully!" });
  } catch (error) {
    console.error("Signup Verify Error:", error);
    res.status(500).json({ message: "❌ Error verifying OTP.", error: error.message });
  }
});

/**
 * ✅ Secure Login with Email/Mobile & Password
 */
router.post("/login", async (req, res) => {
  const { email, mobile, password } = req.body;

  if (!password || (!email && !mobile)) {
    return res.status(400).json({ message: "❌ Email/Mobile & Password are required." });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { email: email || undefined, mobile: mobile || undefined },
    });

    if (!user) {
      return res.status(400).json({ message: "❌ User not found." });
    }

    // ✅ Compare password securely
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: "❌ Invalid credentials." });
    }

    // ✅ Generate JWT token
    const token = jwt.sign({ id: user.id, email: user.email, username: user.username }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ message: "✅ Login successful!", token, user });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "❌ Error logging in.", error: error.message });
  }
});

export default router;
