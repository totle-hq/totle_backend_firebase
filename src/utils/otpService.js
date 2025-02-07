import dotenv from "dotenv";
import nodemailer from "nodemailer";
import twilio from "twilio";
import { userDb } from "../config/prismaClient.js";

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
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code - TOTLE",
      text: `Your OTP code is: ${otp}. It will expire in 5 minutes.`,
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
export const sendOtp = async (email, mobile) => {
  console.log('email send otp', email)
  if (!email && !mobile) {
    throw new Error("❌ No Email or Mobile provided for OTP.");
  }
  const otp = Math.floor(100000 + Math.random() * 900000);
  const expiry = new Date(Date.now() + 5 * 60 * 1000);

  if (email) {
    try {
      const existingOtp = await userDb.otp.findUnique({ where: { email } });
      console.log('existing otp', existingOtp)
      if (existingOtp) {
        if (new Date() < existingOtp.expiry) {
          const timeRemaining = Math.round((existingOtp.expiry - new Date()) / 1000); // Time remaining in seconds
          const minutes = Math.floor(timeRemaining / 60);
          const seconds = timeRemaining % 60;
  
          const professionalMessages = [
            "Your OTP is still valid for ${minutes} minutes and ${seconds} seconds. Please check your email (${email}).",
            "You have ${minutes} minutes and ${seconds} seconds remaining to use your OTP sent to ${email}.",
            "The OTP sent to ${email} is valid for another ${minutes} minutes and ${seconds} seconds.",
          ];
          
          const randomIndex = Math.floor(Math.random() * professionalMessages.length);
          const selectedMessage = professionalMessages[randomIndex].replace("${minutes}", minutes).replace("${seconds}", seconds).replace("${email}", email);
          
          return { 
            error: true,
            message: selectedMessage, 
            expiry: existingOtp.expiry,
            status: "already-sent" 
          };
        } else {
          // Existing OTP has expired; generate a new one
          const professionalSentMessage = "A new OTP has been generated and sent to ${email}. Please use it before it expires.";

          await userDb.otp.update(
            { where: { email: existingOtp.email, },
              data: { otp, expiry, isVerified: false },
          });
          
          await sendEmailOtp(email, otp);

          return { 
            error: false, 
            message: professionalSentMessage.replace("${email}", email) 
          };

        }
      } else {
        // Create a new OTP if none exists
        
        await userDb.otp.create({
          data: {
            email: email,
            otp: otp,
            expiry: expiry,
            isVerified: false,
          },
        });
        
        // console.log('entered send otp email')
        await sendEmailOtp(email, otp);
        return { error: false, message: sentMessage };
      }
    } catch (error) {
      console.error("Error sending OTP:", error);
      return { error: true, message: "Failed sending otp" };
    }
  } else {
    try {
      await sendSmsOtp(mobile, otp);
      return { error: false, mesage: `Otp sent to ${mobile}` }
    } catch (error) {
      console.error("Error sending OTP:", error);
      return { error: true, message: "Failed sending otp" };
    }
  }
};

export const verifyOtp = async ( identifier, otp ) => {
  try {
    // Randomized messages for responses
    const failureMessages = [
      "Invalid OTP, please try again.",
      "Incorrect OTP, request a new one.",
      "Oops! That OTP is not valid.",
    ];
    const expiredMessages = [
      "Your OTP has expired. Please request a new one.",
      "Session expired. Generate a new OTP.",
    ];
    const otpSuccess = [
      "OTP verified successfully!",
      "Great! Your OTP is confirmed.",
    ];

    const randomFailureMessage = failureMessages[Math.floor(Math.random() * failureMessages.length)];
    const randomExpiredMessage = expiredMessages[Math.floor(Math.random() * expiredMessages.length)];
    const otpSuccessMessage = otpSuccess[Math.floor(Math.random() * otpSuccess.length)];

    if (!identifier) {
      return { error: true, message: "Email or Mobile is required." };
    }


    // Fetch OTP record from the specified database model
    // const otpRecord = await userDb.otp.findUnique({
    //   where: { email, otp, isVerified: false },
    // });
    const otpRecord = await userDb.otp.findFirst({
      where: {
        OR: [
          { email: identifier, otp: otp, isVerified: false },
          { mobile: identifier, otp: otp, isVerified: false },
        ],
      },
    });
    

    if (!otpRecord) return { error: true, message: randomFailureMessage };

    // Check if OTP is expired
    if (new Date() > otpRecord.expiry) {
      return { error: true, message: randomExpiredMessage };
    }

    // Verify OTP and update status
    await userDb.otp.updateMany({
      where: {
        OR: [{ email: otpRecord.email }, { mobile: otpRecord.mobile }], // ✅ Works for either email or mobile
      },
      data: { isVerified: true },
    });
    

    return { error: false, message: otpSuccessMessage };
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return { error: true, message: "Something went wrong. Please try again." };
  }
};
