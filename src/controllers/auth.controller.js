import passport from "passport";
import { hashPassword, comparePassword } from "../utils/hashUtils.js";
import {  verifyOtp } from "../utils/otpService.js";
import { sendOtp,sendWelcomeEmail } from "../utils/otpService.js"; // ✅ Utility for OTP sending
// import { userDb } from "../config/prismaClient.js";
// import admin from 'firebase-admin';
import jwt from "jsonwebtoken";
import { generateToken } from "../generateToken.js";
import multer from 'multer';
import fs from "fs"; // ✅ Import file system to read the image
import {User} from "../Models/UserModel.js";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "src/uploads/"); // ✅ Store files in `src/uploads/`
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // ✅ Unique filename
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPEG, PNG, JPG, and WEBP are allowed."), false);
  }
};
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // ✅ 5MB file size limit
});
// import {serviceAccount} from '../../firebaseAdmin.json'

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount)
// })

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

const logout = async (req, res) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: true, message: "Unauthorized: No token provided" });
    }
    const decoded =await verifyToken(token);
    // console.log("Decoded in Logout:", decoded); // ✅ Debugging

    if (!decoded) {
      return res.status(401).json({ error: true, message: "Unauthorized: Invalid token" });
    }
    const userId = Number(decoded.id); // ✅ Ensure `id` is an integer
    if (!userId) {
      return res.status(400).json({ error: true, message: "Invalid token: Missing user ID" });
    }
    // ✅ Update `isLoggedIn` using `id`
    await User.update({ isLoggedIn: false },
      {where: { id: userId }});
    return res.status(200).json({ error: false, message: "Logout successful" });
  } catch (error) {
    console.error("Error during logout: ", error);
    return res.status(500).json({ error: true, message: "Internal Server Error" });
  }
};



const verifyToken = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('decoded', decoded)
    return decoded; // ✅ Ensure it returns the decoded user details
  } catch (error) {
    console.error("Error verifying token:", error);
    return null;
  }
}


export const signupUserAndSendOtp = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: true, message: "Email is required" });
  }

  // const identifier = email || mobile;
  // const isEmail = !!email;

  try {
    console.log("Checking if user exists...");
    const existingUser = await User.findOne({  where: { email } });

    if (existingUser) {
      return res.status(403).json({ error: true, message: `User with this ${isEmail ? "email" : "mobile"} already exists`  });
    }

    console.log("Sending OTP...");
    const otpResponse = await sendOtp(email);

    if (otpResponse.error) {
      return res.status(400).json({ error: true, message: otpResponse.message });
    }

    return res.status(200).json({ error: false, message: otpResponse.message });
  } catch (error) {
    console.error("🔥 ERROR during signup: ", error);
    return res.status(500).json({ error: true, message: "Internal Server Error", details: error.message });
  }
};


export const otpVerification = async (req, res) => {
    const { email, password, firstName } = req.body;
    console.log(req.body);
    let otp = parseInt(req.body.otp, 10);
    if (isNaN(otp)) {
      return { error: true, message: "Invalid OTP format." };
    }
  
    if (!firstName) {
      return res.status(400).json({ error: true, message: "Firstname is required" });
    }
    if ((!email) || !otp) {
      return res.status(400).json({ error: true, message: "Email and OTP are required" });
    }
  
    try {
      const result = await verifyOtp(email, otp);
      if (result.error) {
        return res.status(400).json({ error: true, message: result.message });
      }

      if (email && !password) {
        return res.status(400).json({ error: true, message: "Password is required for email signup" });
      }
  
      const hashedPassword = password ? await hashPassword(password) : null;
  
      // Save the verified user to the database
      const [user, created] = await User.upsert({
        email: email || null,
        mobile: null,
        password: email ? hashedPassword : null,  // ✅ Store password if email-based signup
        isVerified: true,
        firstName: firstName || "", 
        status: "active",
        updatedAt: new Date(),
      });
      await OTP.update(
        { isVerified: true },
        { where: { email: email, otp: otp } }
      );
      if (email) {
        await sendWelcomeEmail(email, firstName);
      }
  
      return res.status(200).json({ error: false, message: "OTP verified successfully ✅" });
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
    const user = await User.findOne({ where: { email } });
    // console.log("User Found:", user);
    
    if (!user) {
      return res.status(400).json({ error: true, message: "User doesn't exist, please register" });
    }
    
    let userToken={id: user.id, email: user.email, userName: user.firstName};
    const match = await comparePassword(password, user.password);
    if (!match) {
      return res.status(401).json({ error: true, message: "Invalid Password" });
    }

    await User.update( { isLoggedIn: true },{where: {id: user.id}});

    const tokenResponse =await generateToken(userToken);
    if (tokenResponse.error) {
      return res.status(500).json({ error: true, message: "Failed to generate token" });
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
      },
      hasSeenWelcomeScreen: false
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
      return res.status(500).json({ error: true, message: "Internal Server Error" });
    }
};
  

export const resetPassword = async (req, res) => {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ error: true, message: "Email and new password are required" });
    }
  
    try {
      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(404).json({ error: true, message: "User not found" });
      }
  
      const hashedPassword = await hashPassword(newPassword);
      await User.update({
        where: { email },
        data: { password: hashedPassword },
      });
  
      return res.status(200).json({ message: "Password has been reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      return res.status(500).json({ error: true, message: "Internal Server Error" });
    }
};

export const getUserProfile = async (req, res) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: true, message: "Unauthorized: Missing token" });
    }
    
    const token = authHeader.split(" ")[1];
    // console.log('token', process.env.JWT_SECRET)

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // console.log('decoded', decoded.id)
      const userId = decoded.id;

      if (!userId) {
        return res.status(401).json({ error: true, message: "Unauthorized: Invalid token" });
      }

      // Fetch user from the database
      const user = await User.findOne({
        where: { id: userId },
        attributes: ['id', 'firstName', 'lastName', 'email', 'dob', 'gender', 'known_language_ids', 'preferred_language_id', 'educational_qualifications', 'status', 'currentOccupation', 'skills', 'years_of_experience', 'location']
      });
      // console.log('user', user)

      if (!user) {
        return res.status(404).json({ error: true, message: "User not found" });
      }

      return res.status(200).json({ success: true, user, hasSeenWelcomeScreen: false });
    } catch (error) {
      return res.status(401).json({ error: true, message: "Unauthorized: Invalid token" });
    }
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res.status(500).json({ error: true, message: "Internal Server Error" });
  }
};

import path from "path";


export const updateUserProfile = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    // console.log("Received Auth Header:", authHeader);

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: true, message: "Unauthorized: Missing token" });
    }

    const token = authHeader.split(" ")[1];

    // ✅ Validate JWT format
    if (!token || token.split(".").length !== 3) {
      return res.status(401).json({ error: true, message: "Unauthorized: Malformed token" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      console.error("❌ JWT Verification Error:", jwtError);
      return res.status(401).json({ error: true, message: "Unauthorized: Invalid or expired token" });
    }

    const userId = decoded.id || decoded.userId || decoded.uid;
    if (!userId) {
      return res.status(401).json({ error: true, message: "Unauthorized: Invalid token payload" });
    }

    // ✅ Extract and validate input data
    let {
      firstName,
      lastName,
      email,
      dob,
      gender,
      knownLanguages,
      preferredLanguage,
      qualification,
      status,
      currentOccupation,
      skills,
      years_of_experience,
      location,
    } = req.body;
    if (req.file) {
      const imagePath = path.join("src/uploads", req.file.filename);
      const imageBuffer = fs.readFileSync(imagePath); // ✅ Read image as buffer
      updateData.image = imageBuffer; // ✅ Store as Bytes in Prisma
    }

    const updateData = {};

    if (email) updateData.email = email;
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (dob) updateData.dob = dob ? new Date(dob).toISOString() : null;
    if (gender) updateData.gender = gender;
    if (qualification) updateData.educational_qualifications = Array.isArray(qualification) ? qualification : [qualification];
    if (status) updateData.status = status;
    if (currentOccupation) updateData.currentOccupation = currentOccupation;
    if (skills) updateData.skills = Array.isArray(skills) ? skills : [];
    if (location) updateData.location = location;

    // ✅ Fix years_of_experience to always be an integer
    updateData.years_of_experience = !isNaN(parseInt(years_of_experience, 10)) ? parseInt(years_of_experience, 10) : 0;

    // ✅ Ensure language IDs are valid numbers
    if (preferredLanguage) {
      preferredLanguage = Number(preferredLanguage);
      if (!isNaN(preferredLanguage) && preferredLanguage > 0) {
        const prefLanguage = await Language.findOne({ where: { language_id: preferredLanguage } });
        if (prefLanguage) updateData.preferred_language_id = prefLanguage.language_id;
      }
    }

    if (knownLanguages) {
      knownLanguages = Array.isArray(knownLanguages) ? knownLanguages.map((lang) => Number(lang)).filter((lang) => !isNaN(lang)) : [];
      if (knownLanguages.length > 0) {
        const knownLanguagesList = await Language.findAll({ where: { language_id: knownLanguages }, attributes: ["language_id"] });
        if (knownLanguagesList.length > 0) updateData.known_language_ids = knownLanguagesList.map((lang) => lang.language_id);
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: true, message: "No valid fields provided for update." });
    }

    // ✅ Update user in the database
    const [updatedRowCount] = await User.update(updateData, { where: { id: userId }, returning: true });

    if (updatedRowCount === 0) {
      return res.status(404).json({ error: true, message: "User not found or no changes detected." });
    }

    const updatedUser = await User.findOne({ where: { id: userId } });

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("❌ Error updating user profile:", error);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
};

export const getUserCount = async (req, res) => {
  try {
    const count = await User.count(); // Count all users in the database
    return res.status(200).json({ count });
  } catch (error) {
    console.error("Error fetching user count:", error);
    return res.status(500).json({ error: true, message: "Internal Server Error" });
  }
};


import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { OTP } from "../Models/OtpModel.js";
import { Language } from "../Models/LanguageModel.js";
import { MarketplaceSuggestion } from "../Models/MarketplaceModel.js";

dotenv.config();

export const sendContactEmail = async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: true, message: "All fields are required!" });
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
    return res.status(200).json({ error: false, message: "Message sent successfully! We will get back to you soon." });
  } catch (error) {
    console.error("❌ Error sending contact email:", error);
    return res.status(500).json({ error: true, message: "Error sending email. Please try again later." });
  }
};


export const submitSuggestion = async (req, res) => {
  try {
    // ✅ Extract JWT Token from Headers
    const token = req.headers.authorization?.split(" ")[1]; // Format: "Bearer <token>"

    if (!token) {
      return res.status(401).json({ error: true, message: "Unauthorized: No token provided." });
    }

    // ✅ Verify Token and Extract User Data
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.userId; // Ensure correct field name
    const userName = decoded.userName || decoded.name; // Adjust based on token payload

    if (!userId || !userName) {
      return res.status(401).json({ error: true, message: "Unauthorized: Invalid token data." });
    }

    const { interest } = req.body;
    if (!interest) {
      return res.status(400).json({ error: true, message: "Interest is required." });
    }

    // ✅ Save Suggestion to Database
    const suggestion = await MarketplaceSuggestion.create({
      userId,
      userName,
      message: interest,
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



export { googleAuth, googleCallback, logout, verifyToken };
