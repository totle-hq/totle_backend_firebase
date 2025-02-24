import passport from "passport";
// import "../config/passportConfig.js"; // Ensure the file extension is .js
// import { prisma } from "../index.js";
import { hashPassword, comparePassword } from "../utils/hashUtils.js";
import {  verifyOtp } from "../utils/otpService.js";
// import prisma from "../config/prismaClient.js"; // ✅ Prisma DB Client
import { sendOtp,sendWelcomeEmail } from "../utils/otpService.js"; // ✅ Utility for OTP sending
import { userDb } from "../config/prismaClient.js";
import admin from 'firebase-admin';
import jwt from "jsonwebtoken";
import { generateToken } from "../generateToken.js";
import multer from 'multer';
import fs from "fs"; // ✅ Import file system to read the image

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
    await userDb.user.update({
      where: { id: userId },
      data: { isLoggedIn: false },
    });
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
  const { email, mobile } = req.body;

  if (!email && !mobile) {
    return res.status(400).json({ error: true, message: "Email/Mobile number is required" });
  }

  const identifier = email || mobile;
  const isEmail = !!email;

  try {
    console.log("Checking if user exists...");
    const existingUser = await userDb.user.findUnique({ where: isEmail? { email }: {mobile} });

    if (existingUser) {
      return res.status(403).json({ error: true, message: `User with this ${isEmail ? "email" : "mobile"} already exists`  });
    }

    console.log("Sending OTP...");
    const otpResponse = await sendOtp(identifier);

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
    const { email, mobile, password, firstName } = req.body;
    let otp = parseInt(req.body.otp, 10);
    if (isNaN(otp)) {
      return { error: true, message: "Invalid OTP format." };
    }
  
    if (!firstName) {
      return res.status(400).json({ error: true, message: "Firstname is required" });
    }
    if ((!email && !mobile) || !otp) {
      return res.status(400).json({ error: true, message: "Email/Mobile and OTP are required" });
    }
  
    try {
      const result = await verifyOtp(email || mobile, otp);
      if (result.error) {
        return res.status(400).json({ error: true, message: result.message });
      }

      if (email && !password) {
        return res.status(400).json({ error: true, message: "Password is required for email signup" });
      }
  
      const hashedPassword = password ? await hashPassword(password) : null;
  
      // Save the verified user to the database
      await userDb.user.upsert({
        where: email ? { email } : { mobile },  // ✅ Use a single unique field
        update: { isVerified: true },  // ✅ If user exists, mark as verified
        create: {
          email: email || null,  // ✅ Store email only if provided
          mobile: mobile || null,  // ✅ Store mobile only if provided
          password: email ? hashedPassword : null,  // ✅ Password only for email signup
          isVerified: true,
          firstName,
        },
      });
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
    const user = await userDb.user.findUnique({ where: { email } });
    let userToken={id: user.id, email: user.email};
    // console.log("User Found:", user);

    if (!user) {
      return res.status(400).json({ error: true, message: "User doesn't exist, please register" });
    }

    const match = await comparePassword(password, user.password);
    if (!match) {
      return res.status(401).json({ error: true, message: "Invalid Password" });
    }

    await userDb.user.update({
      where: { email },
      data: { isLoggedIn: true },
    });

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
      const user = await userDb.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          dob: true,
          gender: true,
          known_language_ids: true,
          preferred_language_id: true,
          educational_qualifications: true,
          status: true,
          currentOccupation: true,
          skills: true,
          years_of_experience: true,
          location: true,
        },
      });
      // console.log('user', user)

      if (!user) {
        return res.status(404).json({ error: true, message: "User not found" });
      }

      return res.status(200).json({ success: true, user });
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
    // ✅ Extract token from Authorization header
    const authHeader = req.headers.authorization;
    console.log("Received Auth Header:", authHeader);
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: true, message: "Unauthorized: Missing token" });
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // console.log("Decoded Token:", decoded); 
      const userId = decoded.id || decoded.userId || decoded.uid;
      if (!userId) {
        return res.status(401).json({ error: true, message: "Unauthorized: Invalid token" });
      }
      
    


    // ✅ Extract fields from request body
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
    // console.log('requird fields', req.body);

    // ✅ Prepare update data
    const updateData = {};

    // ✅ Handle Image Upload (Convert Image to Bytes if Prisma Uses `Bytes`)
    if (req.file) {
      const imagePath = path.join("src/uploads", req.file.filename);
      const imageBuffer = fs.readFileSync(imagePath); // ✅ Read image as buffer
      updateData.image = imageBuffer; // ✅ Store as Bytes in Prisma
    }

    // ✅ Only update fields if they exist in the request body
    if (email) updateData.email=email;
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (dob) updateData.dob = new Date(dob).toISOString();
    if (gender) updateData.gender = gender;
    if (qualification) updateData.educational_qualifications = Array.isArray(qualification) ? qualification : [qualification];
    if (status) updateData.status = status;
    if (currentOccupation) updateData.currentOccupation = currentOccupation;
    if (skills) updateData.skills = Array.isArray(skills) ? skills : [skills]; // ✅ Ensure skills is always an array
    if (years_of_experience !== undefined) updateData.years_of_experience = parseInt(years_of_experience, 10); // ✅ Ensure it's an integer
    if (location) updateData.location = location;

    // ✅ Handle language updates
    if (preferredLanguage) {
      preferredLanguage = Number(preferredLanguage);
      
      if (!isNaN(preferredLanguage)) {
        // console.log("🔹 Searching for Preferred Language ID:", preferredLanguage);
    
        const prefLanguage = await userDb.language.findUnique({
          where: { language_id: preferredLanguage },  // ✅ Search by language_id, not language_name
          select: { language_id: true },
        });
    
        if (prefLanguage) {
          updateData.preferred_language_id = prefLanguage.language_id;
          // console.log("✅ Preferred Language Found:", updateData.preferred_language_id);
        } else {
          console.log("⚠️ Preferred Language Not Found in DB");
        }
      } else {
        console.log("❌ Invalid Preferred Language ID Received:", preferredLanguage);
      }
    }
    

    if (knownLanguages ) {
      if(typeof knownLanguages === 'string'){
        knownLanguages=[knownLanguages]
      }else if(!Array.isArray(knownLanguages)){
        knownLanguages=[]
      }
      knownLanguages = knownLanguages.map(lang => Number(lang)).filter(lang => !isNaN(lang));
      const knownLanguagesList = await userDb.language.findMany({
        where: { language_id: { in: knownLanguages } },
        select: { language_id: true },
      });

      if (knownLanguagesList.length > 0) {
        updateData.known_language_ids = knownLanguagesList.map((lang) => lang.language_id);
        // console.log("✅ Known Languages Found:", updateData.known_language_ids);
      } else {
        console.log("⚠️ No Known Languages Found");
      }
    }

    // ✅ Ensure at least one valid field exists before updating
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: true, message: "No valid fields provided for update." });
    }

    // ✅ Update user in the database
    const updatedUser = await userDb.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        dob: true,
        gender: true,
        educational_qualifications: true,
        status: true,
        currentOccupation: true,
        skills: true,
        years_of_experience: true,
        location: true,
        preferredLanguage: { select: { language_name: true } },
        known_language_ids: true,
        image: true, // ✅ Image stored as Bytes
      },
    });
    // console.log('updated user details' ,updateData)

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user: {
        ...updatedUser,
        preferredLanguage: updatedUser.preferredLanguage?.language_name || null,
        knownLanguages: updatedUser.known_language_ids || [],
      },
    });
  } catch (jwtError) {
    console.error("❌ JWT Verification Error:", jwtError);
    return res.status(401).json({ error: true, message: "Unauthorized: Invalid token" });
  }
  } catch (error) {
    console.error("❌ Error updating user profile:", error);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
};
export const getUserCount = async (req, res) => {
  try {
    const count = await userDb.user.count(); // Count all users in the database
    return res.status(200).json({ count });
  } catch (error) {
    console.error("Error fetching user count:", error);
    return res.status(500).json({ error: true, message: "Internal Server Error" });
  }
};





export { googleAuth, googleCallback, logout, verifyToken };
