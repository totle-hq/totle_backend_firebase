import passport from "passport";
import { hashPassword, comparePassword } from "../../utils/hashUtils.js";
import { verifyOtp } from "../../utils/otpService.js";
import { sendOtp, sendWelcomeEmail } from "../../utils/otpService.js"; // ✅ Utility for OTP sending
// import { userDb } from "../config/prismaClient.js";
// import admin from 'firebase-admin';
import jwt from "jsonwebtoken";
import { generateToken } from "../../generateToken.js";
import multer from "multer";
import fs from "fs"; // ✅ Import file system to read the image
import { User } from "../../Models/UserModels/UserModel.js";
import { BetaUsers } from "../../Models/UserModels/BetaUsersModel.js";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { GetUpdates } from "../../Models/SurveyModels/GetUpdatesModel.js";
import cloudinary from "../../config/cloudinary.js";
import { OTP } from "../../Models/UserModels/OtpModel.js";
import { Language } from "../../Models/LanguageModel.js";
import { MarketplaceSuggestion } from "../../Models/SurveyModels/MarketplaceModel.js";
import { UserMetrics } from "../../Models/UserModels/UserMetricsModel.js";
import { UAParser } from "ua-parser-js";
import useragent from "useragent";
import { getClientIp } from "request-ip"; // ✅ required for IP extraction
import { SessionAttendance } from "../../Models/SessionAttendance.js";
import { Session } from "../../Models/SessionModel.js";
import { col, fn, Op, Sequelize } from "sequelize";
import { Test } from "../../Models/test.model.js";
import { CatalogueNode } from "../../Models/CatalogModels/catalogueNode.model.js";
import { sequelize1 } from "../../config/sequelize.js"; // ✅ for raw SQL insert into cps_profiles
import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  REFRESH_TOKEN_EXPIRES_DAYS
} from "../../utils/tokenUtils.js";
import { SessionToken } from "../../Models/SessionTokenModel.js";
import SessionParticipant from "../../Models/SessionParticipant.js";

dotenv.config();

// --- CPS helper: ensure baseline IQ CPS profile exists for a new user ---
async function ensureCpsProfile(userId, transaction) {
  try {
    await sequelize1.query(
      `
      INSERT INTO "cps"."cps_profiles" (user_id, context_type, context_ref_id)
      VALUES ($1, 'IQ', NULL)
      ON CONFLICT (user_id, context_type, context_ref_id) DO NOTHING;
      `,
      { bind: [userId], transaction }
    );
    console.log(`[CPS] Ensured baseline IQ profile for user ${userId}`);
  } catch (e) {
    console.error(`[CPS] Failed to ensure CPS profile for ${userId}:`, e.message);
  }
}



// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "src/uploads/"); // ✅ Store files in `src/uploads/`
//   },
//   filename: (req, file, cb) => {
//     cb(null, Date.now() + path.extname(file.originalname)); // ✅ Unique filename
//   },
// });

// const fileFilter = (req, file, cb) => {
//   const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
//   if (allowedTypes.includes(file.mimetype)) {
//     cb(null, true);
//   } else {
//     cb(new Error("Invalid file type. Only JPEG, PNG, JPG, and WEBP are allowed."), false);
//   }
// };
// export const upload = multer({
//   storage: storage,
//   fileFilter: fileFilter,
//   limits: { fileSize: 5 * 1024 * 1024 }, // ✅ 5MB file size limit
// });
// import {serviceAccount} from '../../firebaseAdmin.json'

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// })

const googleAuth = (req, res, next) => {
  const isNewUser = req.query.isNew === "true";
  const prompt = isNewUser ? "consent select_account" : "select_account";
  passport.authenticate("google", { scope: ["profile", "email"], prompt })(
    req,
    res,
    next
  );
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

export const logout = async (req, res) => {
  try {
    const refresh = req.cookies.totle_rt;
    if (!refresh)
      return res.status(200).json({ message: "Logged out" });

    const hashed = hashToken(refresh);

    await SessionToken.update(
      { revoked: true },
      { where: { refresh_token_hash: hashed } }
    );

    res.clearCookie("totle_rt");

    return res.json({ message: "Logout success" });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};


const verifyToken = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // console.log('decoded', decoded)
    return decoded; // ✅ Ensure it returns the decoded user details
  } catch (error) {
    console.error("Error verifying token:", error);
    return null;
  }
};

// export const signupUserAndSendOtp = async (req, res) => {
//   const { email } = req.body;

//   if (!email) {
//     return res.status(400).json({ error: true, message: "Email is required" });
//   }

//   // const identifier = email || mobile;
//   // const isEmail = !!email;

//   try {
//     console.log("Checking if user exists...");
//     const existingUser = await User.findOne({ where: { email } });
//     const existingBetaUser = await BetaUsers.findOne({ where: { email } });

//     if (existingUser || existingBetaUser) {
//       return res
//         .status(403)
//         .json({ error: true, message: "User with this email already exists" });
//     }

//     console.log("Sending OTP...");
//     const otpResponse = await sendOtp(email);

//     if (otpResponse.error) {
//       return res
//         .status(400)
//         .json({ error: true, message: otpResponse.message });
//     }

//     return res.status(200).json({ error: false, message: otpResponse.message });
//   } catch (error) {
//     console.error("🔥 ERROR during signup: ", error);
//     return res.status(500).json({
//       error: true,
//       message: "Internal Server Error",
//       details: error.message,
//     });
//   }
// };

export const signupUserAndSendOtp = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: true, message: "Email is required" });
  }

  // const identifier = email || mobile;
  // const isEmail = !!email;

  try {
    console.log("Checking if user exists...");
    const existingUser = await User.findOne({ where: { email } });
    const existingBetaUser = await BetaUsers.findOne({ where: { email } });

    if (existingUser || existingBetaUser) {
      return res
        .status(403)
        .json({ error: true, message: "User with this email already exists" });
    }

    console.log("Sending OTP...");
    const otpResponse = await sendOtp(email);

    if (otpResponse.error) {
      return res
        .status(400)
        .json({ error: true, message: otpResponse.message });
    }

    return res.status(200).json({ error: false, message: otpResponse.message });
  } catch (error) {
    console.error("🔥 ERROR during signup: ", error);
    return res.status(500).json({
      error: true,
      message: "Internal Server Error",
      details: error.message,
    });
  }
};

export const otpVerification = async (req, res) => {
  const { email, password, firstName, gender, dob, parentalConsent, parentEmail } = req.body;
  console.log(req.body);

  let otp = parseInt(req.body.otp, 10);
  if (isNaN(otp)) {
    return res
      .status(400)
      .json({ error: true, message: "Invalid OTP format." });
  }

  if (!firstName) {
    return res
      .status(400)
      .json({ error: true, message: "Firstname is required" });
  }

  if (!email || !otp) {
    return res
      .status(400)
      .json({ error: true, message: "Email and OTP are required" });
  }

  // ✅ Optional gender validation
  if (gender && !["male", "female", "other"].includes(gender.toLowerCase())) {
    return res
      .status(400)
      .json({ error: true, message: "Invalid gender value" });
  }

  try {
    // Step 1: Verify OTP
    const result = await verifyOtp(email, otp);
    if (result.error) {
      return res.status(400).json({ error: true, message: result.message });
    }

    // Step 2: Password check for email signups
    if (email && !password) {
      return res.status(400).json({
        error: true,
        message: "Password is required for email signup",
      });
    }

    // Step 3: Hash password if provided
    const hashedPassword = password ? await hashPassword(password) : null;
    // Age calculation
    const dobDate = new Date(dob);
    const today = new Date();
    const age =
      today.getFullYear() - dobDate.getFullYear() -
      (today < new Date(today.getFullYear(), dobDate.getMonth(), dobDate.getDate()) ? 1 : 0);

    if (age < 11) {
      return res.status(400).json({
        error: true,
        message: "Minimum age requirement is 11 years.",
      });
    }

    // Tag minors
    const isMinor = age < 18;

    if (age >= 11 && age < 18) {
      if (!parentalConsent || !parentEmail) {
        return res.status(400).json({
          error: true,
          message: "Parental consent and parent email are required for users aged 11 to 18.",
        });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(parentEmail)) {
        return res.status(400).json({
          error: true,
          message: "Invalid parent email format.",
        });
      }
    }
    //added consent
    const [user, created] = await User.upsert({
      email: email || null,
      password: email ? hashedPassword : null,
      isVerified: true,
      firstName: firstName || "",
      dob,
      gender: gender?.toLowerCase() || null,
      status: "active",
      isMinor,
      minorConsentAccepted: !isMinor || !!req.body.parentalConsent,
      parentEmail: isMinor ? parentEmail : null,
      updatedAt: new Date()
    }, { returning: true });

    await ensureCpsProfile(user.id); // ✅ make sure cps_profiles has a row for this user


    // Step 5: Save user metrics
    console.log("Saving UserMetrics for user:", user?.id);
    await UserMetrics.create({ userId: user.id });

    // Step 6: Handle beta users
    let betaFlag = false;
    const betaUserCount = await BetaUsers.count();
    if (betaUserCount < 1001) {
      betaFlag = true;
      try {
        await BetaUsers.create({ email, firstName });
        console.log("✅ Successfully inserted into BetaUsers");
      } catch (err) {
        console.error("❌ Error inserting into BetaUsers:", err);
      }
    }

    // Step 7: Mark OTP as verified
    await OTP.update(
      { isVerified: true },
      { where: { email: email, otp: otp } }
    );

    // Step 8: Send welcome email
    if (email) {
      await sendWelcomeEmail(email, firstName);
    }

    // Step 9: Respond success
    return res.status(200).json({
      error: false,
      message: "OTP verified successfully ✅",
      betaFlag: betaFlag,
    });
  } catch (error) {
    console.error("Error during OTP verification:", error);
    return res
      .status(500)
      .json({ error: true, message: "Internal server error." });
  }
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: true, message: "Missing credentials" });

  try {
    const user = await User.findOne({ where: { email } });
    if (!user)
      return res.status(400).json({ error: true, message: "User not found" });

    if (user.status === "blacklist")
      return res.status(403).json({
        error: true,
        message: "Your account has been blocked. Contact support."
      });

    const match = await comparePassword(password, user.password);
    if (!match)
      return res.status(401).json({ error: true, message: "Invalid password" });

    // metadata logging
    const parser = new UAParser(req.headers["user-agent"]);
    const browser = parser.getBrowser().name;
    const os = parser.getOS().name;
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress ||
      null;

    await User.update(
      { isLoggedIn: true, ipAddress: ip, browser, os },
      { where: { id: user.id } }
    );

    // ---- TOKEN CREATION ----
    const payload = { id: user.id, email: user.email, userName: user.firstName };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken();
    const hashedRefresh = hashToken(refreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);

    // Save to DB (one row per device)
    await SessionToken.create({
      user_id: user.id,
      refresh_token_hash: hashedRefresh,
      device: parser.getDevice().type || "browser",
      browser,
      os,
      ip,
      expires_at: expiresAt
    });

    const isDevlopment = process.env.NODE_ENV_DEV === "development";

    // ---- SEND REFRESH TOKEN AS HTTPONLY COOKIE ----
    res.cookie("totle_rt", refreshToken, {
      httpOnly: true,
      secure: isDevlopment,
      sameSite: isDevlopment ? "lax" : "strict",
      maxAge: REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.cookie("totle_at", accessToken, {
        httpOnly: true,
        secure: isDevlopment,
        sameSite: isDevlopment ? "lax" : "strict",
        maxAge: 60 * 60 * 1000, // 1 hour
        path: "/"
      });


    return res.status(200).json({
      error: false,
      message: "Login successful",
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ error: true, message: "Server error" });
  }
};

export const resetUser = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: true, message: "Email is required" });
  }
  try {
    const otpRecord = await User.findOne({ where: { email } });

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
    return res
      .status(500)
      .json({ error: true, message: "Internal Server Error" });
  }
};

export const verifyResetOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res
      .status(400)
      .json({ error: true, message: "Email and OTP are required" });
  }
  try {
    const result = await verifyOtp(email, otp);
    if (result.error) {
      return res.status(400).json({ error: true, message: result.message });
    }

    return res
      .status(200)
      .json({ error: false, message: "OTP verified successfully" });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return res
      .status(500)
      .json({ error: true, message: "Internal Server Error" });
  }
};

export const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !newPassword || !otp) {
    return res
      .status(400)
      .json({ error: true, message: "Email and new password are required" });
  }

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: true, message: "User not found" });
    }

    const hashedPassword = await hashPassword(newPassword);
    await User.update({ password: hashedPassword }, { where: { email } });

    return res
      .status(200)
      .json({ message: "Password has been reset successfully" });
  } catch (error) {
    console.error("Error resetting password:", error);
    return res
      .status(500)
      .json({ error: true, message: "Internal Server Error" });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    // Extract token from Authorization header
    const token = req.cookies?.totle_at;
    // console.log('tokenn', token)
    // console.log('token', process.env.JWT_SECRET)

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("decoded", decoded.id);
      const userId = decoded.id;

      if (!userId) {
        return res
          .status(401)
          .json({ error: true, message: "Unauthorized: Invalid token" });
      }

      // ✅ Get IP Address
      const rawIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
      const ip_address = rawIp.includes("::ffff:")
        ? rawIp.split("::ffff:")[1]
        : rawIp;

      // ✅ Update user's IP address in DB
      await User.update({ ip_address }, { where: { id: userId } });

      // Fetch user from the database
      const user = await User.findOne({
        where: { id: userId },
        attributes: [
          "id",
          "firstName",
          "lastName",
          "email",
          "dob",
          "gender",
          "known_language_ids",
          "preferred_language_id",
          "educational_qualifications",
          "status",
          "currentOccupation",
          "skills",
          "years_of_experience",
          "location",
          "profilePictureUrl",
          "ip_address", // ✅ Include IP in return if needed
        ],
      });

      if (!user) {
        return res.status(404).json({ error: true, message: "User not found" });
      }

      return res
        .status(200)
        .json({ success: true, user, hasSeenWelcomeScreen: false });
    } catch (error) {
      return res
        .status(401)
        .json({ error: true, message: "Unauthorized: Invalid token" });
    }
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res
      .status(500)
      .json({ error: true, message: "Internal Server Error" });
  }
};

export const updateProfileMeta = async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const { profileTimezone, deviceType } = req.body;

    const user = await User.findByPk(userId);

    const updatePayload = {};

    if (profileTimezone) {
      updatePayload.profileTimezone = profileTimezone;
    }

    if (deviceType && !user.deviceType) {
      updatePayload.deviceType = deviceType;
    }

    if (Object.keys(updatePayload).length > 0) {
      await User.update(updatePayload, { where: { id: userId } });
      console.log("✅ Updated fields:", updatePayload);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Error updating metadata:", error);
    return res.status(500).json({ success: false });
  }
};

export const getBetaUserProfile = async (req, res) => {
  try {
    console.log("beta user profile");
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: true, message: "Unauthorized: Missing token" });
    }
    // debugger
    const token = authHeader.split(" ")[1];
    // console.log('tokenn', token)
    // console.log('token', process.env.JWT_SECRET)

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("decoded", decoded.id);
      console.log("profile decode", decoded);
      const userEmail = decoded.email;

      if (!userEmail) {
        return res
          .status(401)
          .json({ error: true, message: "Unauthorized: Not a beta user" });
      }

      // Fetch user from the database
      const user = await BetaUsers.findOne({
        where: { email: decoded.email },
        attributes: ["id"],
      });
      // console.log('user', user)

      if (!user) {
        return res.status(404).json({ error: true, message: "User not found" });
      }

      return res.status(200).json({ success: true, user });
    } catch (error) {
      return res
        .status(401)
        .json({ error: true, message: "Unauthorized: Invalid token" });
    }
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res
      .status(500)
      .json({ error: true, message: "Internal Server Error" });
  }
};

export const getAllBetaUsers = async (req, res) => {
  try {
    const allUsers = await BetaUsers.findAll({
      attributes: ["id", "firstName", "profilePictureUrl"],
      order: [["createdAt", "ASC"]],
    });

    res.status(200).json(allUsers);
  } catch (error) {
    console.error("Error fetching beta users:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to retrieve beta users." });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: true, message: "Unauthorized: Missing token" });
    }

    const token = authHeader.split(" ")[1];

    if (!token || token.split(".").length !== 3) {
      return res
        .status(401)
        .json({ error: true, message: "Unauthorized: Malformed token" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      console.error("❌ JWT Verification Error:", jwtError);
      return res.status(401).json({
        error: true,
        message: "Unauthorized: Invalid or expired token",
      });
    }

    const userId = decoded.id || decoded.userId || decoded.uid;
    if (!userId) {
      return res
        .status(401)
        .json({ error: true, message: "Unauthorized: Invalid token payload" });
    }

    const updateData = {};
    let {
      firstName,
      lastName,
      email,
      dob,
      knownLanguages,
      preferredLanguage,
      qualification,
      status,
      currentOccupation,
      skills,
      years_of_experience,
      location,
    } = req.body;

    const user = await User.findOne({ where: { id: userId } });

    if (req.file && req.file.buffer) {
      if (user.profile_picture_id) {
        try {
          await cloudinary.uploader.destroy(user.profile_picture_id);
        } catch (err) {
          console.warn("⚠️ Failed to delete old image:", err);
        }
      }

      const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

      const result = await cloudinary.uploader.upload(base64Image, {
        folder: "totle-profile-pics",
      });

      updateData.profilePictureUrl = result.secure_url;
      updateData.profile_picture_id = result.public_id;

      const betaUser = await BetaUsers.findOne({
        where: { email: user.email },
      });
      if (betaUser) {
        await BetaUsers.update(
          { profilePictureUrl: result.secure_url },
          { where: { id: betaUser.id } }
        );
      }
    }

    if (email) updateData.email = email;
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (dob) {
      const existingDob = user.dob
        ? new Date(user.dob).toISOString().split("T")[0]
        : null;
      const newDob = new Date(dob).toISOString().split("T")[0];

      if (!existingDob) {
        updateData.dob = newDob;
      } else if (existingDob !== newDob) {
        return res.status(400).json({
          error: true,
          message: "Date of Birth cannot be changed once set.",
        });
      }
    }
    // ✅ Gender update logic
if (req.body.gender) {
  const newGender = req.body.gender.toLowerCase();
  const validGenders = ["male", "female", "other"];

  if (!validGenders.includes(newGender)) {
    return res.status(400).json({
      error: true,
      message: "Invalid gender value.",
    });
  }

  // Prevent changing gender once set, if needed
  if (user.gender && user.gender !== newGender) {
    return res.status(400).json({
      error: true,
      message: "Gender cannot be changed once set.",
    });
  }

  updateData.gender = newGender;
}

    if (qualification)
      updateData.educational_qualifications = Array.isArray(qualification)
        ? qualification
        : [qualification];
    if (status) updateData.status = status;
    if (currentOccupation) updateData.currentOccupation = currentOccupation;
    if (skills) updateData.skills = Array.isArray(skills) ? skills : [];
    if (location) updateData.location = location;

    updateData.years_of_experience = !isNaN(parseInt(years_of_experience, 10))
      ? parseInt(years_of_experience, 10)
      : 0;

    if (preferredLanguage) {
      preferredLanguage = Number(preferredLanguage);
      if (!isNaN(preferredLanguage) && preferredLanguage > 0) {
        const prefLanguage = await Language.findOne({
          where: { language_id: preferredLanguage },
        });
        if (prefLanguage)
          updateData.preferred_language_id = prefLanguage.language_id;
      }
    }

    if (knownLanguages) {
      // Always parse JSON if it comes as a string
      if (typeof knownLanguages === "string") {
        try {
          knownLanguages = JSON.parse(knownLanguages);
        } catch (e) {
          // If it's just a single number string, wrap it in array
          knownLanguages = [Number(knownLanguages)];
        }
      }

      knownLanguages = Array.isArray(knownLanguages)
        ? knownLanguages
            .map((lang) => Number(lang))
            .filter((lang) => !isNaN(lang))
        : [];
        const knownLanguagesList = await Language.findAll({
          where: { language_id: knownLanguages },
          attributes: ["language_id"],
        });
          updateData.known_language_ids = knownLanguagesList.map(
            (lang) => lang.language_id
          );
    }

    // ✅ Client metadata handling (IP, deviceType, browser, OS)
    const source = req.headers["user-agent"] || "";
    const ua = useragent.parse(source);
    const ip = getClientIp(req) || req.ip;

    updateData.ipAddress = ip;
    updateData.deviceType = ua.platform || "unknown";
    updateData.browser = ua.toAgent() || "unknown";
    updateData.os = ua.os.toString() || "unknown"; // ✅ fixed: toString to prevent Sequelize error

    if (Object.keys(updateData).length === 0) {
      return res
        .status(400)
        .json({ error: true, message: "No valid fields provided for update." });
    }

    // ✅ Update user in the database
    const [updatedRowCount] = await User.update(updateData, {
      where: { id: userId },
      returning: true,
    });

    if (updatedRowCount === 0) {
      return res.status(404).json({
        error: true,
        message: "User not found or no changes detected.",
      });
    }

    const updatedUser = await User.findOne({ where: { id: userId } });

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("❌ Error updating user profile:", error);
    return res
      .status(500)
      .json({ error: true, message: "Internal server error" });
  }
};

export const getUserCount = async (req, res) => {
  try {
    const count = await BetaUsers.count(); // Count all users in the database
    console.log("counting", count);
    return res.status(200).json({ count });
  } catch (error) {
    console.error("Error fetching user count:", error);
    return res
      .status(500)
      .json({ error: true, message: "Internal Server Error" });
  }
};

export const getWelcome = async (req, res) =>
  res.status(200).json({ hasSeenWelcomeScreen: false });

export const updateWelcome = async (req, res) => {
  let { hasSeenWelcomeScreen } = req.body;
  if (hasSeenWelcomeScreen) {
    return res
      .status(200)
      .json({ success: true, message: "Welcome status updated" });
  } else {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const sendContactEmail = async (req, res) => {
  const { name, email, message } = req.body;
  console.log('email', email);

  if (!name || !email || !message) {
    return res
      .status(400)
      .json({ error: true, message: "All fields are required!" });
  }

  try {
    // Configure Email Transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // Your email
        pass: process.env.EMAIL_PASS, // App password (if using Gmail)
      },
    });

    // Email Content
    const mailOptions = {
      from: process.env.EMAIL_USER, // Sender Email
      to: ["support@totle.co", "totleedtech@gmail.com"], // Destination Email
      replyTo: email,
      subject: `New Contact Form Submission from ${name}`,
      html: `
        <h3>Contact Form Submission</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `,
    };

    // Send Email
    await transporter.sendMail(mailOptions);

    console.log("✅ Contact Email Sent!");
    return res.status(200).json({
      error: false,
      message: "Message sent successfully! We will get back to you soon.",
    });
  } catch (error) {
    console.error("❌ Error sending contact email:", error);
    return res.status(500).json({
      error: true,
      message: "Error sending email. Please try again later.",
    });
  }
};

export const submitSuggestion = async (req, res) => {
  try {
    // ✅ Extract JWT Token from Headers
    const token = req.headers.authorization?.split(" ")[1]; // Format: "Bearer <token>"

    if (!token) {
      return res
        .status(401)
        .json({ error: true, message: "Unauthorized: No token provided." });
    }

    // ✅ Verify Token and Extract User Data
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.userId; // Ensure correct field name
    const userName = decoded.userName || decoded.name; // Adjust based on token payload

    if (!userId || !userName) {
      return res
        .status(401)
        .json({ error: true, message: "Unauthorized: Invalid token data." });
    }

    const { interest, teach, learn } = req.body;
    if (!interest) {
      return res
        .status(400)
        .json({ error: true, message: "Interest is required." });
    }

    // ✅ Save Suggestion to Database
    const suggestion = await MarketplaceSuggestion.create({
      userId,
      userName,
      message: interest,
      teach: teach || "",
      learn: learn || "",
    });

    return res.status(201).json({
      success: true,
      message: "Suggestion submitted successfully!",
      suggestion,
    });
  } catch (error) {
    console.error("❌ Error submitting suggestion:", error);
    return res.status(500).json({ error: true, message: "Server error." });
  }
};

export const getUpdates = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: true, message: "Unauthorized: Missing token" });
    }

    const token = authHeader.split(" ")[1];
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res
        .status(401)
        .json({ error: true, message: "Unauthorized: Invalid token" });
    }

    const userId = decoded.id || decoded.userId || decoded.uid;
    if (!userId) {
      return res
        .status(401)
        .json({ error: true, message: "Unauthorized: Invalid token payload" });
    }

    const user = await User.findOne({ where: { id: userId } });
    if (!user || !user.email) {
      return res
        .status(404)
        .json({ error: true, message: "User not found or email missing" });
    }

    const { teach, learn, endeavour } = req.body;
    const updateFields = {};

    if (teach === true) updateFields.teach = true;
    if (learn === true) updateFields.learn = true;
    if (endeavour === true) updateFields.endeavour = true;

    const [existing, created] = await GetUpdates.findOrCreate({
      where: { email: user.email },
      defaults: {
        email: user.email,
        firstName: user.firstName || "",
        teach: !!teach,
        learn: !!learn,
        endeavour: !!endeavour,
      },
    });

    if (!created) {
      // Already exists — update interests only if they were newly selected
      await existing.update(updateFields);
      return res.status(200).json({
        error: false,
        message: "✅ Preferences updated successfully!",
      });
    }

    return res
      .status(200)
      .json({ error: false, message: "✅ Thanks! You'll get updates soon." });
  } catch (error) {
    console.error("❌ Error in getUpdates:", error);
    return res
      .status(500)
      .json({ error: true, message: "Internal Server Error" });
  }
};


export const SummaryOfHomePage = async (req, res) => {
  try {
    // ✅ Get total users count
    const userCount = await User.count();

    // ✅ Get all unique session_ids from SessionAttendance where users were present
    const attendedSessions = await SessionAttendance.findAll({
      where: {
        status: 'present', // Only count attended sessions
        session_id: { [Op.ne]: null }
      },
      attributes: ['session_id'],
      group: ['session_id'],
      raw: true
    });

    // ✅ Extract unique session IDs
    const attendedSessionIds = attendedSessions.map(s => s.session_id);

    // ✅ Count how many attended sessions there are
    const attendedSessionCount = attendedSessionIds.length;

    // ✅ Calculate total duration for attended sessions only
    const learnerDurationData = await SessionParticipant.findOne({
      attributes: [
        [fn("SUM", col("duration_seconds")), "total_seconds"]
      ],
      where: {
        role: "learner",
        duration_seconds: { [Op.ne]: null }
      },
      raw: true,
    });

    const totalMinutes = Math.floor((learnerDurationData?.total_seconds || 0) / 60);

     const mentorsByTopic = await Test.findAll({
      where: {
        eligible_for_bridger: true,
        topic_uuid: { [Sequelize.Op.ne]: null }
      },
      attributes: [
        "topic_uuid",
        [fn("COUNT", fn("DISTINCT", col("user_id"))), "eligible_user_count"]
      ],
      group: ["topic_uuid"],
      raw: true
    });

    // ✅ Calculate total unique mentors across all topics
    const totalMentorCount = await Test.count({
      distinct: true,
      col: "user_id",
      where: {
        eligible_for_bridger: true,
        topic_uuid: { [Sequelize.Op.ne]: null }
      }
    });

    const topics = await CatalogueNode.count({
      where: { is_topic : true }
    });

    const domains = await CatalogueNode.count({
      where: { is_domain : true }
    });

    return res.status(200).json({
      users: userCount,
      sessions: attendedSessionCount,
      minutes: totalMinutes,
      mentors: totalMentorCount,
      topics: topics,
      domains: domains,
    });

  } catch (error) {
    console.error("❌ Error in SummaryOfHomePage:", error);
    return res
      .status(500)
      .json({ error: true, message: "Internal Server Error" });
  }
};

export const ChangeUserPassword = async (req, res) => {
  try {
    const {id} = req.user;
    const { newPassword} = req.body;
    if (!newPassword) {
      return res.status(400).json({ error: true, message: "Please enter the new Password" });
    }
    const hashedPassword = await hashPassword(newPassword);
    await User.update({ password: hashedPassword }, { where: { id } });
    return res.status(200).json({ error: false, message: "Password changed successfully" });
  } catch (error) {
    console.error("❌ Error in ChangeUserPassword:", error);
    return res
      .status(500)
      .json({ error: true, message: "Internal Server Error" });
  }
}
export { googleAuth, googleCallback, verifyToken };

export const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.totle_rt;

    if (!refreshToken)
      return res.status(401).json({ error: "No refresh token" });

    const hashed = hashToken(refreshToken);

    const session = await SessionToken.findOne({
      where: { refresh_token_hash: hashed, revoked: false }
    });

    if (!session)
      return res.status(401).json({ error: "Refresh token invalid" });

    if (new Date() > new Date(session.expires_at))
      return res.status(401).json({ error: "Refresh token expired" });

    const user = await User.findOne({ where: { id: session.user_id } });

    // rotate token
    const newRefresh = generateRefreshToken();
    const newHash = hashToken(newRefresh);

    await session.update({
      refresh_token_hash: newHash,
      expires_at: new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 86400000)
    });

    // send new refresh cookie
    res.cookie("totle_rt", newRefresh, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: REFRESH_TOKEN_EXPIRES_DAYS * 86400000
    });

    // new access token
    const newAccess = generateAccessToken({
      id: user.id,
      email: user.email,
      userName: user.firstName
    });

    return res.json({ accessToken: newAccess });
  } catch (err) {
    console.error("Refresh Error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};
