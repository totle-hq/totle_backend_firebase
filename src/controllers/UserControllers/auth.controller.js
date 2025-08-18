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

dotenv.config();

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

const logout = async (req, res) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return res
        .status(401)
        .json({ error: true, message: "Unauthorized: No token provided" });
    }
    const decoded = await verifyToken(token);
    // console.log("Decoded in Logout:", decoded); // ✅ Debugging

    if (!decoded) {
      return res
        .status(401)
        .json({ error: true, message: "Unauthorized: Invalid token" });
    }
    const userId = decoded.id; // ✅ Ensure `id` is an integer
    if (!userId) {
      return res
        .status(400)
        .json({ error: true, message: "Invalid token: Missing user ID" });
    }
    // ✅ Update `isLoggedIn` using `id`
    await User.update({ isLoggedIn: false }, { where: { id: userId } });
    return res.status(200).json({ error: false, message: "Logout successful" });
  } catch (error) {
    console.error("Error during logout: ", error);
    return res
      .status(500)
      .json({ error: true, message: "Internal Server Error" });
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
  const { email, password, firstName, gender } = req.body;
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

    // Step 4: Create or update user
    const [user, created] = await User.upsert(
      {
        email: email || null,
        mobile: null,
        password: email ? hashedPassword : null,
        isVerified: true,
        firstName: firstName || "",
        gender: gender?.toLowerCase() || null, // ✅ Save gender
        status: "active",
        updatedAt: new Date(),
      },
      { returning: true }
    );

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

  if (!email)
    return res
      .status(400)
      .json({ error: true, message: "Please enter your email" });
  if (!password)
    return res
      .status(400)
      .json({ error: true, message: "Please enter your password" });

  try {
    const user = await User.findOne({ where: { email } });
    const betaUser = await BetaUsers.findOne({ where: { email } });
    // console.log("User Found:", user);

    if (!user && !betaUser) {
      return res
        .status(400)
        .json({ error: true, message: "User doesn't exist, please register" });
    }

    let userToken = {
      id: user.id,
      email: user.email,
      userName: user.firstName,
    };
    const match = await comparePassword(password, user.password);
    if (!match) {
      return res.status(401).json({ error: true, message: "Invalid Password" });
    }

    await User.update({ isLoggedIn: true }, { where: { id: user.id } });
    //  ip during login

    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      null;
    // await User.update(
    //     { ipAddress: ip },
    //     { where: { id: user.id } }  // ✅ Add this line
    //     );

    //  os, browsertype,

    const parser = new UAParser(req.headers["user-agent"]);
    const browser = `${parser.getBrowser().name} ${parser.getBrowser().version}`;
    const os = `${parser.getOS().name} ${parser.getOS().version}`;

    console.log("✅ Login Metadata:", { ip, browser, os });

    // ✅ Update user login metadata
    await User.update(
      {
        isLoggedIn: true,
        ipAddress: ip,
        browser,
        os,
      },
      { where: { id: user.id } }
    );

    const tokenResponse = await generateToken(userToken);
    if (tokenResponse.error) {
      return res
        .status(500)
        .json({ error: true, message: "Failed to generate token" });
    }

    return res.status(200).json({
      error: false,
      message: "Login successful",
      token: tokenResponse.token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName || null,
        email: user.email,
        // preferredLanguage,
        // knownLanguages,
        // ipAddress: user.ip
      },
      hasSeenWelcomeScreen: false,
    });
  } catch (error) {
    console.error("Error during login: ", error);
    return res
      .status(500)
      .json({ error: true, message: "Internal Server Error" });
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
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: true, message: "Unauthorized: Missing token" });
    }

    const token = authHeader.split(" ")[1];
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
import useragent from "useragent";
import { getClientIp } from "request-ip"; // ✅ required for IP extraction

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
    console.log("Existing gender:", user.gender);
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
      from: email, // Sender Email
      to: "support@totle.co", // Destination Email
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

export { googleAuth, googleCallback, logout, verifyToken };
