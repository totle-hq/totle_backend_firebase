import passport from "passport";
import "../config/passportConfig.js"; // Ensure the file extension is .js
import { prisma } from "../index.js";
import { hashPassword, comparePassword } from "../utils/hashUtils.js";
import { sendOtp, verifyOtp } from "../utils/otpService.js";
import { generateToken } from "../utils/jwtUtils.js";
// import prisma from "../config/prismaClient.js"; // ✅ Prisma DB Client
import { userDb, catalogDb } from "../config/prismaClient.js"
import { sendOtp } from "../utils/otpService.js"; // ✅ Utility for OTP sending

const googleAuth = (req, res, next) => {
  const isNewUser = req.query.isNew === "true";
  const prompt = isNewUser ? "consent select_account" : "select_account";
  passport.authenticate("google", { scope: ["profile", "email"], prompt })(req, res, next);
};

const googleCallback = (req, res, next) => {
  console.log("Google callback route reached");
  passport.authenticate("google", (err, user, info) => {
    if (err || !user) {
      console.error("Authentication failed:", err || "No user found");
      return res.redirect("/");
    }
    req.logIn(user, (loginErr) => {
      if (loginErr) {
        console.error("Login error:", loginErr);
        return next(loginErr);
      }
      console.log("Login successful. Redirecting to /platform");
      return res.redirect(`https://www.totle.co/platform`);
    });
  })(req, res, next);
};

const logout = (req, res) => {
  req.logout(() => {
    res.redirect("/");
  });
};

const verifyToken = async (req, res) => {
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
}


export const signupUserAndSendOtp = async (req, res) => {
  const { email, mobile } = req.body;

  if (!email || !mobile) return res.status(400).json({ error: true, message: "Email/Mobile number is required" });
//   if (!password) return res.status(400).json({ error: true, message: "Password is required" });

  try {
    const existingUser = await userDb.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(403).json({ error: true, message: "User with this email exists" });
    }

    const otpResponse = await sendOtp(email);
    if (otpResponse.error) {
      return res.status(400).json({ error: true, message: otpResponse.message });
    }

    return res.status(200).json({ error: false, message: otpResponse.message });
  } catch (error) {
    console.error("Error during signup: ", error);
    return res.status(500).json({ error: true, message: "Internal Server Error" });
  }
};

export const otpVerification = async (req, res) => {
    const { email, otp, password, firstName } = req.body;
  
    if (!firstName) {
      return res.status(400).json({ error: true, message: "Username is required" });
    }
    if (!email || !otp) {
      return res.status(400).json({ error: true, message: "Email and OTP are required" });
    }
  
    try {
      const result = await verifyOtp(email, otp);
      if (result.error) {
        return res.status(400).json({ error: true, message: result.message });
      }
  
      const hashedPassword = await hashPassword(password);
  
      // Save the verified user to the database
      await userDb.user.create({
        data: {
          email,
          password: hashedPassword,
          isVerified: true,
          firstName: firstName,
        },
      });
  
      return res.status(200).json({ error: false, message: "OTP verified and user registered successfully!" });
    } catch (error) {
      console.error("Error during OTP verification:", error);
      return res.status(500).json({ error: true, message: "Internal server error." });
    }
};
  

export const completeSignup = async (req, res) => {
  const { preferredLanguage, knownLanguages, email } = req.body;

  if (!preferredLanguage || !Array.isArray(knownLanguages)) {
    return res.status(400).json({ error: true, message: "Languages are required." });
  }

  try {
    const prefLanguage = await userDb.language.findUnique({
      where: { language_name: preferredLanguage },
      select: { language_id: true },
    });

    if (!prefLanguage) {
      return res.status(400).json({ error: true, message: "Preferred language not found." });
    }

    const knownLanguagesList = await userDb.language.findMany({
      where: { language_name: { in: knownLanguages } },
      select: { language_id: true },
    });

    if (knownLanguagesList.length !== knownLanguages.length) {
      return res.status(400).json({ error: true, message: "One or more known languages are invalid." });
    }

    await userDb.user.update({
      where: { email },
      data: {
        preferred_language_id: prefLanguage.language_id,
        known_language_ids: knownLanguagesList.map(lang => lang.language_id),
      },
    });

    return res.status(201).json({ error: false, message: "User registered successfully." });
  } catch (error) {
    console.error("Error during final registration:", error);
    return res.status(500).json({ error: true, message: "Internal server error." });
  }
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email) return res.status(400).json({ error: true, message: "Please enter your email" });
  if (!password) return res.status(400).json({ error: true, message: "Please enter your password" });

  try {
    const user = await userDb.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(400).json({ error: true, message: "User doesn't exist, please register" });
    }

    const match = await comparePassword(password, user.password);
    if (!match) {
      return res.status(401).json({ error: true, message: "Invalid login credentials" });
    }

    const token = generateToken(user);

    const preferredLanguage = await userDb.language.findUnique({
      where: { language_id: user.preferred_language_id },
    });

    const knownLanguages = await userDb.language.findMany({
      where: { language_id: { in: user.known_language_ids } },
    });

    return res.status(200).json({
      error: false,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        preferredLanguage,
        knownLanguages,
      },
    });
  } catch (error) {
    console.error("Error during login: ", error);
    return res.status(500).json({ error: true, message: "Internal Server Error" });
  }
};

export const resetUser = async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: true, message: "Email is required" });
    }
    try {
      const otpRecord = await userDb.otp.findUnique({ where: { email } });
  
      if (otpRecord) {
        const timeRemaining = Math.round((otpRecord.expiry - new Date()) / 1000);
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
  
        if (new Date() < otpRecord.expiry) {
          return res.status(200).json({
            error: false,
            message: `Your OTP is still valid for ${minutes}m ${seconds}s.`,
          });
        }
      }
  
      const result = await sendOtp(email);
      if (result.error) {
        return res.status(500).json({ error: true, message: result.message });
      }
  
      return res.status(200).json({ error: false, message: result.message });
    } catch (error) {
      console.error("Error during OTP reset: ", error);
      return res.status(500).json({ error: true, message: "Internal Server Error" });
    }
};
  

export const resetPassword = async (req, res) => {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ error: true, message: "Email and new password are required" });
    }
  
    try {
      const user = await userDb.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(404).json({ error: true, message: "User not found" });
      }
  
      const hashedPassword = await hashPassword(newPassword);
      await userDb.user.update({
        where: { email },
        data: { password: hashedPassword },
      });
  
      return res.status(200).json({ message: "Password has been reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      return res.status(500).json({ error: true, message: "Internal Server Error" });
    }
  };

export { googleAuth, googleCallback, logout, verifyToken };
