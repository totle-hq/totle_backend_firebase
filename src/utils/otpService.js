import nodemailer from "nodemailer";
import twilio from "twilio";

// ✅ Configure Twilio Client for SMS OTP
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// ✅ Configure Email Transporter for Email OTP
const transporter = nodemailer.createTransport({
  service: "Gmail",
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
export const sendOtp = async (email, mobile, otp) => {
  if (!email && !mobile) {
    throw new Error("❌ No Email or Mobile provided for OTP.");
  }

  if (email) {
    await sendEmailOtp(email, otp);
  } else {
    await sendSmsOtp(mobile, otp);
  }
};
