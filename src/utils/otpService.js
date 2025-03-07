import fs from "fs";
import path from "path";import dotenv from "dotenv";
import nodemailer from "nodemailer";
import twilio from "twilio";
// import { userDb } from "../config/prismaClient.js";
import { fileURLToPath } from "url";
import {OTP} from "../Models/OtpModel.js";
import { Sequelize } from "sequelize";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
// ✅ Configure Twilio Client for SMS OTP
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// ✅ Configure Email Transporter for Email OTP
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * ✅ Send OTP to Email
 * @param {string} email - User's Email Address
 * @param {string} otp - OTP Code
 */
export const sendEmailOtp = async (email, otp) => {
  if (!email) throw new Error("❌ Email is required for OTP.");
  console.log('email', email, 'otp', otp)

  try {

    const templatePath = path.join(__dirname, "email.html"); // Update the path accordingly
    let emailTemplate = fs.readFileSync(templatePath, "utf-8");
    emailTemplate = emailTemplate.replace("{{OTP}}", otp);
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code - TOTLE",
      html: emailTemplate,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email OTP sent to ${email}`);
  } catch (error) {
    console.error("❌ Email OTP Sending Error:", error);
    throw new Error("Error sending Email OTP.");
  }
};

/**
 * ✅ Send OTP to Mobile (SMS)
 * @param {string} mobile - User's Mobile Number
 * @param {string} otp - OTP Code
 */
export const sendSmsOtp = async (mobile, otp) => {
  if (!mobile) throw new Error("❌ Mobile number is required for OTP.");

  try {
    // ✅ Ensure Mobile Number has +91 Prefix (for India)
    if (!mobile.startsWith("+91")) {
      mobile = "+91" + mobile;
    }

    await twilioClient.messages.create({
      body: `Your OTP code is: ${otp}. It will expire in 5 minutes. Do NOT share with anyone!`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: mobile,
    });

    console.log(`✅ SMS OTP sent to ${mobile}`);
  } catch (error) {
    console.error("❌ SMS OTP Sending Error:", error);
    throw new Error("Error sending SMS OTP.");
  }
};

/**
 * ✅ Send OTP to Either Email or Mobile
 * @param {string} email - User's Email (Optional)
 * @param {string} mobile - User's Mobile Number (Optional)
 * @param {string} otp - OTP Code
 */
export const sendOtp = async (identifier) => {
  console.log('email send otp', identifier)
  if (!identifier) {
    throw new Error("❌ No Email  provided for OTP.");
  }
  const otp = Math.floor(100000 + Math.random() * 900000);
  const expiry = new Date(Date.now() + 5 * 60 * 1000);
  // const isEmail = identifier.includes("@");
  // if (identifier) {
    try {
      const existingOtp = await OTP.findOne({ where: { email } });
      // const existingOtp = await OTP.findOne({ where: { email:identifier } });
      console.log('existing otp', existingOtp)
      if (existingOtp) {
        if (new Date() < existingOtp.expiry) {
          const timeRemaining = Math.round((existingOtp.expiry - new Date()) / 1000); // Time remaining in seconds
          const minutes = Math.floor(timeRemaining / 60);
          const seconds = timeRemaining % 60;
  
          const professionalMessages = [
            "Your OTP is still valid for ${minutes} minutes and ${seconds} seconds. Please check your email (${identifier}).",
            "You have ${minutes} minutes and ${seconds} seconds remaining to use your OTP sent to ${identifier}.",
            "The OTP sent to ${identifier} is valid for another ${minutes} minutes and ${seconds} seconds.",
          ];
          
          const randomIndex = Math.floor(Math.random() * professionalMessages.length);
          const selectedMessage = professionalMessages[randomIndex].replace("${minutes}", minutes).replace("${seconds}", seconds).replace("${identifier}", identifier);
          
          return { 
            error: true,
            message: selectedMessage, 
            expiry: existingOtp.expiry,
            status: "already-sent" 
          };
        } else {
          // Existing OTP has expired; generate a new one
          const professionalSentMessage = "A new OTP has been generated and sent to ${identifier}. Please use it before it expires.";

          await OTP.update(
            { otp, expiry, isVerified: false },
            { where: { email: identifier }
          });
          
          await sendEmailOtp(identifier, otp);

          return { 
            error: false, 
            message: professionalSentMessage.replace("${identifier}", identifier) 
          };

        }
      } else {
        // Create a new OTP if none exists
        
        await OTP.create({
            email: identifier,
            otp: otp,
            expiry: expiry,
            isVerified: false,
        });
        
        // console.log('entered send otp email')
        await sendEmailOtp(identifier, otp);
        return { error: false, message: `An OTP is sent for registration, Please check your ${identifier} inbox` };
      }
    } catch (error) {
      console.error("Error sending OTP:", error);
      return { error: true, message: "Failed sending otp" };
    }
  // } else {
  //   try {
  //     await sendSmsOtp(identifier, otp);
  //     return { error: false, mesage: `Otp sent to ${identifier}` }
  //   } catch (error) {
  //     console.error("Error sending OTP:", error);
  //     return { error: true, message: "Failed sending otp" };
  //   }
  // }
};

export const verifyOtp = async ( identifier, otp ) => {
  try {

    if (!identifier || !otp) {
      return { error: true, message: "❌ Email or Mobile and OTP are required." };
    }

    // ✅ Fetch OTP from database
    const otpRecord = await OTP.findOne({
      where: {
        [Sequelize.Op.or]: [
          { email: identifier, otp: otp, isVerified: false },
          { mobile: identifier, otp: otp, isVerified: false },
        ],
      },
    });

    if (!otpRecord) {
      console.log("❌ OTP Not Found or Already Used.");
      return { error: true, message: "Invalid OTP, please try again." };
    }

    // ✅ Check if OTP is expired
    if (new Date() > otpRecord.expiry) {
      console.log("⏳ OTP Expired:", otpRecord.expiry);
      return { error: true, message: "Your OTP has expired. Please request a new one." };
    }

    // ✅ Verify OTP
    await OTP.update({ isVerified: true }, { where: { email: identifier } });
    return { error: false, message: "OTP verified successfully!" };

  } catch (error) {
    return { error: true, message: "Something went wrong. Please try again.", details: error.message };
  }
};


export const sendWelcomeEmail = async (email, firstName) => {
  try {
    // ✅ Load the email template
    const templatePath = path.join(__dirname, "welcome3.html");  // Adjust path if necessary
    let emailTemplate = fs.readFileSync(templatePath, "utf-8");

    // ✅ Replace placeholders with actual values
    emailTemplate = emailTemplate.replace("[User's Name]", firstName);
    emailTemplate = emailTemplate.replace('<a class="button">🚀 Login to Your Account</a>', 
      `<a href="http://localhost:3000/auth" class="button">🚀 Login to Your Account</a>`);

    // ✅ Email options
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "🎉 Welcome to TOTLE!",
      html: emailTemplate,
    };

    // ✅ Send Email
    await transporter.sendMail(mailOptions);
    console.log(`✅ Welcome Email sent to ${email}`);
  } catch (error) {
    console.error("❌ Error sending Welcome Email:", error);
  }
};
