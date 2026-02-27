import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import twilio from "twilio";
import { fileURLToPath } from "url";
import { OTP } from "../Models/UserModels/OtpModel.js";
import { Sequelize } from "sequelize";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

/* ------------------------------------------------------------------
   ✅ SAFE TWILIO INITIALIZATION (THE ONLY REAL FIX)
------------------------------------------------------------------ */
let twilioClient = null;

if (
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN
) {
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
}

/* ------------------------------------------------------------------
   ✅ EMAIL TRANSPORTER (UNCHANGED)
------------------------------------------------------------------ */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* ------------------------------------------------------------------
   EMAIL OTP
------------------------------------------------------------------ */
export const sendEmailOtp = async (email, otp) => {
  if (!email) throw new Error("❌ Email is required for OTP.");
  console.log("email", email, "otp", otp, process.env.EMAIL_PASS);

  try {
    const templatePath = path.join(__dirname, "email.html");
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

/* ------------------------------------------------------------------
   SMS OTP
------------------------------------------------------------------ */
export const sendSmsOtp = async (mobile, otp) => {
  if (!mobile) throw new Error("❌ Mobile number is required for OTP.");

  if (!twilioClient) {
    throw new Error("❌ Twilio is not configured");
  }

  try {
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

/* ------------------------------------------------------------------
   SEND OTP (EMAIL ONLY – UNCHANGED LOGIC)
------------------------------------------------------------------ */
export const sendOtp = async (email) => {
  console.log("email send otp", email);

  if (!email) {
    throw new Error("❌ No Email provided for OTP.");
  }

  const otp = Math.floor(100000 + Math.random() * 900000);
  const expiry = new Date(Date.now() + 5 * 60 * 1000);

  try {
    const existingOtp = await OTP.findOne({ where: { email } });

    if (existingOtp) {
      if (new Date() < existingOtp.expiry) {
        const timeRemaining = Math.round(
          (existingOtp.expiry - new Date()) / 1000
        );
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;

        const professionalMessages = [
          "Your OTP is still valid for ${minutes} minutes and ${seconds} seconds. Please check your email (${identifier}).",
          "You have ${minutes} minutes and ${seconds} seconds remaining to use your OTP sent to ${identifier}.",
          "The OTP sent to ${identifier} is valid for another ${minutes} minutes and ${seconds} seconds.",
        ];

        const selectedMessage = professionalMessages[
          Math.floor(Math.random() * professionalMessages.length)
        ]
          .replace("${minutes}", minutes)
          .replace("${seconds}", seconds)
          .replace("${identifier}", email);

        return {
          error: false,
          message: selectedMessage,
          expiry: existingOtp.expiry,
          nextStep: "already-sent",
        };
      } else {
        await OTP.update(
          { otp, expiry, isVerified: false },
          { where: { email } }
        );

        await sendEmailOtp(email, otp);

        return {
          error: false,
          message: `A new OTP has been generated and sent to ${email}.`,
        };
      }
    } else {
      await OTP.create({
        email,
        otp,
        expiry,
        isVerified: false,
      });

      await sendEmailOtp(email, otp);

      return {
        error: false,
        message: `An OTP is sent for registration, Please check your ${email} inbox`,
      };
    }
  } catch (error) {
    console.error("Error sending OTP:", error);
    return { error: true, message: "Failed sending otp to email" };
  }
};

/* ------------------------------------------------------------------
   VERIFY OTP
------------------------------------------------------------------ */
export const verifyOtp = async (email, otp) => {
  try {
    if (!email || !otp) {
      return { error: true, message: "❌ Email and OTP are required." };
    }

    const otpRecord = await OTP.findOne({
      where: { email, otp },
    });

    if (!otpRecord) {
      return { error: true, message: "Invalid OTP, please try again." };
    }

    if (new Date() > otpRecord.expiry) {
      return {
        error: true,
        message: "Your OTP has expired. Please request a new one.",
      };
    }

    await OTP.update({ isVerified: true }, { where: { email } });

    return { error: false, message: "OTP verified successfully!" };
  } catch (error) {
    return {
      error: true,
      message: "Something went wrong. Please try again.",
      details: error.message,
    };
  }
};

/* ------------------------------------------------------------------
   WELCOME EMAIL
------------------------------------------------------------------ */
export const sendWelcomeEmail = async (email, firstName) => {
  try {
    const templatePath = path.join(__dirname, "welcome4.html");
    const attachmentPath = path.join(__dirname, "guide.pdf");
    let emailTemplate = fs.readFileSync(templatePath, "utf-8");

    emailTemplate = emailTemplate.replace("[User's Name]", firstName);
    emailTemplate = emailTemplate.replace(
      '<a class="button">🚀 Login to Your Account</a>',
      `<a href="http://totle.co/auth" class="button">🚀 Login to Your Account</a>`
    );

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "🎉 Welcome to TOTLE!  — Let’s Begin Your Journey to Teach and Learn",
      html: emailTemplate,
      attachments: [
        {
          filename: "TOTLE-Welcome-Guide.pdf",
          path: attachmentPath,
          contentType: "application/pdf",
        },
      ],
    });

    console.log(`✅ Welcome Email sent to ${email}`);
  } catch (error) {
    console.error("❌ Error sending Welcome Email:", error);
  }
};

/* ------------------------------------------------------------------
   SESSION BOOKED EMAIL
------------------------------------------------------------------ */
export const sendSessionBookedEmail = async ({
  to,
  role,
  otherUserName,
  topicName,
  scheduledAt,
}) => {
  const subject =
    role === "learner"
      ? "✅ Your session is booked on TOTLE"
      : "📘 New learner booked a session";

  const html = `
    <p>Hi,</p>
    <p>Your session has been successfully booked.</p>
    <p><b>Topic:</b> ${topicName}</p>
    <p><b>With:</b> ${otherUserName}</p>
    <p><b>Scheduled at:</b> ${scheduledAt}</p>
    <br/>
    <p>— Team TOTLE</p>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    html,
  });
};
