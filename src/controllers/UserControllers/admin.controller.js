
// import { userDb } from "../config/prismaClient.js";
import {Admin} from '../../Models/UserModels/AdminModel.js';
import {Blog} from '../../Models/SurveyModels/BlogModel.js';
import {Survey} from '../../Models/SurveyModels/SurveyModel.js';
import { User } from '../../Models/UserModels/UserModel.js';
import { Language } from '../../Models/LanguageModel.js';
import { Question } from '../../Models/SurveyModels/QuestionModel.js';
import {Responses} from '../../Models/SurveyModels/ResponsesModel.js';
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

import multer from "multer";
import path, { format } from "path";
import fs from "fs";
import { MarketplaceSuggestion } from '../../Models/SurveyModels/MarketplaceModel.js';
import { type } from 'os';
import { BetaUsers } from '../../Models/UserModels/BetaUsersModel.js';
import { AdminActionLog } from '../../Models/UserModels/AdminActionLogModel.js';
import { getAdminContext } from '../../utils/getAdminContext.js';
import { Department } from '../../Models/UserModels/Department.js';
import { Op, Sequelize } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { UserDepartment } from '../../Models/UserModels/UserDepartment.js';
import { is } from 'useragent';
import { sequelize1 } from '../../config/sequelize.js';
import { FeedbackSummary } from '../../Models/feedbacksummary.js';
import Feedback from '../../Models/feedbackModels.js';
import { Teachertopicstats } from '../../Models/TeachertopicstatsModel.js';
import { CatalogueNode } from '../../Models/CatalogModels/catalogueNode.model.js';
import { CpsProfile } from '../../Models/CpsProfile.model.js';
import { runDbSync } from '../../config/syncDb.js';
import { Test } from '../../Models/test.model.js';
import { Session } from '../../Models/SessionModel.js';
// import { role } from '@stream-io/video-react-sdk';

// Ensure uploads folder exists
const uploadDir = "src/uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "src/uploads/"); // Store in backend
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
  },
});

const upload = multer({ storage });

// import ExcelJS from "exceljs";

dotenv.config();


export const createAdmin = async (email, password) => {
  return await Admin.create({ // Sequelize Admin model
    email, 
    password,
    status: "active",
  });
};

export const findAdminByEmail = async (email) => {
  return await Admin.findOne({ where: { email } }); // Sequelize Admin model
};

export const findRoleByName = async (email) => {
  return await UserDepartment.findOne({ where: {email } }); // Sequelize Admin model
};

export const updateAdminStatus = async (adminId, status) => {
  return await Admin.update({ status }, { where: { id: adminId } }); // Sequelize Admin model
};


export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    let admin = await findAdminByEmail(email);
    let isFromUserDept = false;
    console.info("is admin",admin);

    if (admin == undefined) {
      admin = await findRoleByName(email);
      isFromUserDept = true;
    }

    if (!admin) {
      return res.status(400).json({ message: "Invalid Login" });
    }

    // Normalize fields (Admin vs UserDepartment)
    const userId = admin.id || admin.roleId;
    const userName = admin.name || "No Name";
    const userEmail = admin.email;
    const userPassword = admin.password;
    const userStatus = admin.status || "active";
    const userRole = isFromUserDept ? admin.roleName : admin.global_role;

    if (userStatus !== "active") {
      return res.status(403).json({ message: "Account is inactive. Contact Super Admin." });
    }
    let isMatch = await bcrypt.compare(password, userPassword);
    console.log('Is match', isMatch)
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    console.log("[CPS] Skipped for Nucleus users — CPS applies only to app-side users (teachers/learners).");


    const token = jwt.sign(
      {
        id: userId,
        name: userName,
        email: userEmail,
        role: userRole,
        status: userStatus,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    let departmentName = null;

    if (isFromUserDept) {
      const dept = await Department.findOne({
        where: { id: admin.departmentId },
      });
      departmentName = dept?.codename || null;
    }

    res.cookie("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 1000, // 1 hour
    });
    res.status(200).json({
      message: "Successfully Logged in!",
      token,
      admin: {
        id: userId,
        name: userName,
        email: userEmail,
        global_role: userRole,
        department: departmentName,
      },
    });

    // Socket event
    io.emit("userLoginStatus", { userId, isLoggedIn: true });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

export const ensureAllCpsProfiles = async () => {
  try {
    // Only learners and teachers should have CPS profiles
    const eligibleRoles = ["learner", "teacher", "bridger", "expert", "master", "legend"];

    const users = await User.findAll({
      where: { role: eligibleRoles },
      attributes: ["id"],
    });

    let createdCount = 0;
    let existingCount = 0;

    for (const u of users) {
      const [profile, created] = await CpsProfile.findOrCreate({
        where: {
          user_id: u.id,
          context_type: "IQ", // mandatory for CPS
        },
        defaults: {
          user_id: u.id,
          context_type: "IQ",
          context_ref_id: null,
          tests_seen: 0,
        },
      });

      if (created) createdCount++;
      else existingCount++;
    }

    return {
      success: true,
      message: "CPS profiles ensured for all eligible app users",
      summary: {
        totalEligible: users.length,
        createdProfiles: createdCount,
        existingProfiles: existingCount,
      },
    };
  } catch (err) {
    console.error("[Research CPS] ensure-all-profiles failed:", err);
    throw err;
  }
};

export const getAdminDetails = async (req, res) => {
  try {
    const token = req.header("Authorization");

    if (!token) {
      return res.status(401).json({ message: "No token, authorization denied" });
    }

    const decoded = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);
    if (!decoded) {
      return res.status(401).json({ message: "Invalid token" });
    }

    // Find admin by decoded token ID
    const admin = await Admin.findOne({ where: { id: decoded.id } });

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.json({
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        status: admin.status
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};



export const createBlog = async (req, res) => {
  try {
    if (!req.admin) return res.status(401).json({ message: "Unauthorized" });
    const { title, slug, description, content, image } = req.body;
    console.log('blog', req.body)

    if (!title || !slug || !description || !content) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const adminId = req.admin.id; // Get admin ID from authentication
    if (!req.admin || !req.admin.id) {
      return res.status(401).json({ message: "Unauthorized: Admin ID is missing" });
    }

    const blog = await Blog.create({
        title,
        slug,
        description,
        content,
        image,
        adminId, 
    });

    res.status(201).json({ message: "Blog created successfully", blog });
  } catch (error) {
    console.log("error creating blog", error)
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


// ✅ Fetch All Blogs
export const getAllBlogs = async (req, res) => {
  try {
    const blogs = await Blog.findAll({
      include: {
        admin: {
          select: { name: true, email: true },
        },
      },
    });

    // ✅ Ensure image paths are correctly formatted
    const blogsWithImages = blogs.map((blog) => ({
      ...blog,
      image: blog.image ? `${req.protocol}://${req.get("host")}${blog.image}` : null,
    }));

    res.json(blogsWithImages);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

export const getBlogById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const blog = await Blog.findOne({
      where: { id: Number(id) },
      include: {
        admin: { select: { name: true, email: true } },
      },
    });

    if (!blog) return res.status(404).json({ message: "Blog not found" });

    // ✅ Ensure image URL is correctly formatted
    const blogWithImage = {
      ...blog,
      image: blog.image ? `${req.protocol}://${req.get("host")}${blog.image}` : null,
    };

    res.json(blogWithImage);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};


// ✅ Fetch Single Blog by ID
export const getAdminBlogs = async (req, res) => {
  try {
    const adminId = req.admin.id; // Get admin ID from authentication
    console.log('admin id', adminId)

    const blogs = await Blog.findAll({
      where: { adminId },
    });

    res.json(blogs);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};


// ✅ Update Blog
export const updateBlog = async (req, res) => {
  try {
    if (!req.admin || !req.admin.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { id } = req.params;
    const { title, slug, description, content, image } = req.body;
    const adminId = req.admin.id;

    const blog = await Blog.findOne({ where: { id } });

    if (!blog) return res.status(404).json({ message: "Blog not found" });
    if (blog.adminId !== adminId) return res.status(403).json({ message: "Unauthorized" });

    const updatedBlog = await Blog.update({
      where: { id },
      data: { title, slug, description, content, image },
    });

    res.json({ message: "Blog updated successfully", blog: updatedBlog });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};


// ✅ Delete Blog
export const deleteBlog = async (req, res) => {
  try {
    if (!req.admin || !req.admin.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { id } = req.params;
    const adminId = req.admin.id;

    const blog = await Blog.findOne({ where: { id } });

    if (!blog) return res.status(404).json({ message: "Blog not found" });
    if (blog.adminId !== adminId) return res.status(403).json({ message: "Unauthorized" });

    await Blog.destroy({ where: { id } });

    res.json({ message: "Blog deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// ✅ Upload Route (Backend API)
export const uploadImage= (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  // Return image path
  res.json({ imagePath: `/uploads/${req.file.filename}` });
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: [
        "id",
        "firstName",
        "lastName",
        "email",
        "isVerified",
        "status",
        "location",
        "mobile",
        "currentOccupation",
        "skills",
        "isLoggedIn", 
      ],
      include: [
        {
          model: Language,
          as: "preferredLanguage", // ✅ Ensure association exists in `associations.js`
          attributes: ["language_name"],
        },
      ],
    });

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

export const createOrUpdateSurvey = async (req, res) => {
  try {
    console.log("Received survey data:", req.body);
    const {surveyId} = req.params;
    const { title, questions, adminId } = req.body;

    if (!adminId || !title || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "Admin ID, title, and questions are required" });
    }

    let survey;
    let existingQuestions=[];
    if (surveyId) {
      // ✅ Step 1: If surveyId exists, update the survey
      survey = await Survey.findByPk(surveyId, { include: [{ model: Question, as: "questions" }] });
      if (!survey) {
        return res.status(404).json({ message: "Survey not found" });
      }
      survey.title = title;
      await survey.save();

      // ✅ Step 2: Delete existing questions (to replace with new ones)
      existingQuestions = survey.questions;
      const incomingQuestionIds = questions.map(q => q.id).filter(id => id); // IDs of incoming questions
      const deletedQuestions = existingQuestions.filter(eq => !incomingQuestionIds.includes(eq.id));
      await Promise.all(deletedQuestions.map(q => q.destroy()));

      for (const q of questions) {
        const existingQuestion = existingQuestions.find(eq => eq.id === q.id);

        if (existingQuestion) {
          // ✅ Update existing question
          existingQuestion.text = q.text;
          existingQuestion.type = q.type;
          existingQuestion.status = q.status || "active";
          existingQuestion.options = q.type === "text" ? null : Array.isArray(q.options) ? q.options : [];
          await existingQuestion.save();
        } else {
          // ✅ Add new question
          await Question.create({
            surveyId,
            text: q.text,
            type: q.type,
            status: q.status || "active",
            options: q.type === "text" ? null : Array.isArray(q.options) ? q.options : [],
          });
        }
      }
    } else {
      // ✅ Step 1: Create new survey
      survey = await Survey.create({
        adminId,
        title,
      });
      await Promise.all(
        questions.map(q =>
          Question.create({
            surveyId: survey.id,
            text: q.text,
            type: q.type,
            options: q.type === "text" ? null : Array.isArray(q.options) ? q.options : [],
          })
        )
      );
    }

    const updatedSurvey = await Survey.findByPk(surveyId, {
      include: [{ model: Question, as: "questions" }], // ✅ Alias added
    });

    // ✅ Step 4: Send Response
    res.status(200).json({
      message: surveyId ? "Survey updated successfully" : "Survey created successfully",
      survey: updatedSurvey,
    });

  } catch (error) {
    console.error("❌ Error creating/updating survey:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};




// ✅ Get All Surveys
export const getAllSurveys = async (req, res) => {
  try {
    const token=req.header("Authorization");
    if (!token) {
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ message: "Invalid token", error: error.message });
    }

    const userId = decoded.id; // ✅ Extract user ID from token
    // console.log('userId', userId)

    const surveys = await Survey.findAll({
      attributes: ['id', 'title'], // ✅ Select survey fields
      include: [
        {
          model: Question,
          as: "questions",
          attributes: ['id', 'text', 'type', 'options'], 
        },
        {
          model: Responses,
          attributes: ['statusSubmitted'],
          required: false,
          where: { userId }, // ✅ Only fetch responses from the logged-in user
        }
      ],
    });

    // ✅ Transform response: Ensure `statusSubmitted` is correctly set for each survey
    const formattedSurveys = surveys.map((survey) => ({
      id: survey.id,
      title: survey.title,
      submitted: survey.Responses?.[0]?.statusSubmitted ?? false, // ✅ Extract submission status
    }));

    // console.log('form', formattedSurveys)
    res.status(200).json(formattedSurveys);
  } catch (error) {
    console.error("❌ Error fetching surveys:", error);
    res.status(500).json({ message: "Server error", error });
  }
};



// ✅ Get Survey Results
export const getSurveyResults = async (req, res) => {
  try {
    // ✅ Fetch all surveys with all questions (ensures missing questions are included)
    const surveys = await Survey.findAll({
      attributes: ["id", "title"],
      include: [
        {
          model: Question,
          as: "questions",
          attributes: ["id", "text", "type", "options"],
        },
      ],
    });

    // ✅ Fetch all submitted responses
    const responses = await Responses.findAll({
      attributes: ["surveyId", "questionId", "answer"],
      where: { statusSubmitted: "submitted" },
    });

    if (!surveys.length) {
      return res.status(404).json({ message: "No surveys found" });
    }

    const surveyMap = {};

    // ✅ Initialize survey structure with all questions and options (pre-set to 0)
    surveys.forEach((survey) => {
      if (!surveyMap[survey.id]) {
        surveyMap[survey.id] = {
          survey: survey.title,
          results: {},
        };
      }

      survey.questions.forEach((question) => {
        if (!surveyMap[survey.id].results[question.id]) {
          surveyMap[survey.id].results[question.id] = {
            question: question.text,
            responses: {},
          };

          // ✅ Initialize multiple-choice/single-choice options with 0 count
          if (question.type === "multiple-choice" || question.type === "single-choice") {
            (question.options || []).forEach((opt) => {
              surveyMap[survey.id].results[question.id].responses[opt] = 0;
            });
          } else {
            surveyMap[survey.id].results[question.id].responses["Text Responses"] = 0;
          }
        }
      });
    });

    // ✅ Process submitted responses and update counts correctly
    responses.forEach(({ surveyId, questionId, answer }) => {
      if (!surveyMap[surveyId] || !surveyMap[surveyId].results[questionId]) return;

      const question = surveyMap[surveyId].results[questionId];

      if (answer) {
        if (question.responses["Text Responses"] !== undefined) {
          // ✅ Count text-based answers correctly
          question.responses["Text Responses"] += 1;
        } else {
          // ✅ Ensure answer is split properly for multiple-choice/single-choice
          let selectedOptions = Array.isArray(answer) ? answer : answer.split(",").map(opt => opt.trim());

          selectedOptions.forEach((opt) => {
            if (question.responses.hasOwnProperty(opt)) {
              question.responses[opt] += 1;
            }
          });
        }
      }
    });

    // ✅ Convert results into an array format for the frontend
    const formattedResults = Object.values(surveyMap).map((survey) => ({
      survey: survey.survey,
      results: Object.values(survey.results),
    }));

    res.status(200).json(formattedResults);
  } catch (error) {
    console.error("❌ Error fetching survey results:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

export const getSurveyNames = async (req, res) => {
  try {
    const surveys = await Survey.findAll({
      attributes: ["id", "title"],
    });

    res.status(200).json(surveys);
  } catch (error) {
    console.error("❌ Error fetching survey names:", error);
    res.status(500).json({ message: "Server error", error });
  }
}

export const getResultsBySurveyId = async (req, res) => {
  try {
    const { surveyId } = req.params;

    if (!surveyId) {
      return res.status(400).json({ message: "Survey ID is required" });
    }

    // ✅ Fetch all questions for this survey
    const surveyQuestions = await Question.findAll({
      where: { surveyId },
      attributes: ["id", "text", "type", "options"],
    });

    if (!surveyQuestions.length) {
      return res.status(404).json({ message: "No questions found for this survey" });
    }

    // ✅ Fetch all submitted responses for this survey
    const responses = await Responses.findAll({
      attributes: ["questionId", "answer"],
      where: { surveyId, statusSubmitted: "submitted" },
    });

    const questionMap = {}; // Store questions & aggregate responses

    // ✅ Initialize all questions with response options set to 0
    surveyQuestions.forEach((question) => {
      questionMap[question.id] = {
        question: question.text.trim(),
        type: question.type,
        responses: {},
      };

      if (question.type === "multiple-choice" || question.type === "single-choice") {
        (question.options || []).forEach((opt) => {
          questionMap[question.id].responses[opt.trim()] = 0; // ✅ Ensure response keys are properly formatted
        });
      }
    });

    // ✅ Process responses and update counts correctly
    responses.forEach(({ questionId, answer }) => {
      if (!questionMap[questionId]) return;

      const question = questionMap[questionId];

      if (question.type === "multiple-choice" || question.type === "single-choice") {
        const selectedOptions = Array.isArray(answer)
          ? answer
          : answer.split(",").map(opt => opt.trim());

        selectedOptions.forEach((opt) => {
          if (question.responses.hasOwnProperty(opt)) {
            question.responses[opt] += 1;
          }
        });
      }
      else if (question.type === "text") {
        // ✅ Initialize text responses if not present
        if (!question.responses) {
          question.responses = {};
        }
    
        if (question.responses.hasOwnProperty(answer.trim())) {
          question.responses[answer.trim()] += 1;
        } else {
          question.responses[answer.trim()] = 1;
        }
      }
    });

    // ✅ Convert aggregated results to an array
    const formattedResults = Object.values(questionMap);

    console.log(`✅ Results for Survey ${surveyId}:`, formattedResults);
    res.status(200).json(formattedResults);
  } catch (error) {
    console.error("❌ Error fetching survey results:", error);
    res.status(500).json({ message: "Server error", error });
  }
};




export const submitSurveyResponse = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const { responses } = req.body;
    const token = req.header("Authorization");

    // ✅ 1️⃣ Check if token is provided
    if (!token) {
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ message: "Invalid token", error: error.message });
    }

    const userId = decoded.id;

    // ✅ 2️⃣ Validate Inputs
    if (!surveyId || !responses || typeof responses !== "object" || Object.keys(responses).length === 0) {
      return res.status(400).json({ message: "Survey ID and responses are required, and responses must be an object" });
    }

    const surveyExists = await Survey.findOne({ where: { id: surveyId } });
    if (!surveyExists) {
      return res.status(404).json({ message: "Invalid survey ID" });
    }

    // ✅ 3️⃣ Process Each Response
    await Promise.all(
      Object.entries(responses).map(async ([questionId, answer]) => {
        if (!questionId || answer === undefined || answer === null) {
          throw new Error(`Invalid response format for question ${questionId}`);
        }

        const question = await Question.findOne({ where: { id: questionId } });
        if (!question) {
          throw new Error(`Question ID ${questionId} does not exist`);
        }

        // ✅ 4️⃣ Ensure Correct Answer Format
        let formattedAnswer;
        switch (question.type) {
          case "multiple-choice":
            formattedAnswer = Array.isArray(answer) ? answer : [answer]; // Ensure array format
            break;
          case "rating-scale":
            formattedAnswer = Number(answer); // Convert rating-scale to number
            break;
          default:
            formattedAnswer = String(answer); // Store text or single-choice as a string
        }

        // ✅ 5️⃣ Prevent Duplicate Responses: Update if exists, otherwise create new
        const existingResponse = await Responses.findOne({ where: { surveyId, userId, questionId } });
        if (existingResponse) {
          await existingResponse.update({ answer: formattedAnswer, statusSubmitted: "submitted" });
        } else {
          await Responses.create({ surveyId, userId, questionId, answer: formattedAnswer, statusSubmitted: "submitted" });
        }
      })
    );

    // ✅ 6️⃣ Return Success Message
    res.status(201).json({ message: "Survey submitted successfully" , submitted: true});

  } catch (error) {
    console.error("❌ Error submitting survey:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



// ✅ API for Admins to Fetch All Suggestions
export const getAllSuggestionsForAdmin = async (req, res) => {
  try {
    const suggestions = await MarketplaceSuggestion.findAll({
      include: [
        {
          model: User,
          attributes: ["firstName"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({ success: true, suggestions });
  } catch (error) {
    console.error("❌ Error fetching suggestions for admin:", error);
    return res.status(500).json({ error: true, message: "Server error." });
  }
};

export const getQuestionsBySurveyId = async (req, res) => {
  try {
    const { surveyId } = req.params;

    const surveyTitle = await Survey.findOne({
      where: { id: surveyId },
      attributes: ["title"],
    });
    let title=surveyTitle.title;

    // ✅ Fetch questions where surveyId matches
    const questions = await Question.findAll({
      where: { surveyId },
      attributes: ["id", "text", "type", "options" ,"status"],
    });

    if (!questions || questions.length === 0) {
      return res.status(404).json({ message: "No questions found for this survey" });
    }

    // console.log("Fetched Questions:", questions); // ✅ Debugging log

    res.status(200).json({ title, questions });
  } catch (error) {
    console.error("❌ Error fetching questions:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

export const displayQuestionsBySurveyId = async (req, res) => {
  try {
    const { surveyId } = req.params;

    const surveyTitle = await Survey.findOne({
      where: { id: surveyId },
      attributes: ["title"],
    });
    let title=surveyTitle.title;

    // ✅ Fetch questions where surveyId matches
    const questions = await Question.findAll({
      where: { surveyId, status: "active", },
      attributes: ["id", "text", "type", "options"],
    });

    if (!questions || questions.length === 0) {
      return res.status(404).json({ message: "No questions found for this survey" });
    }

    // console.log("Fetched Questions:", questions); // ✅ Debugging log

    res.status(200).json({ title, questions });
  } catch (error) {
    console.error("❌ Error fetching questions:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

export const deleteSurveyById = async (req, res) => {
  try {
    const { surveyId } = req.params;

    // ✅ Check if the survey exists
    const survey = await Survey.findByPk(surveyId);
    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    // ✅ Delete all questions linked to this survey
    await Question.destroy({ where: { surveyId } });

    // ✅ Delete the survey
    await Survey.destroy({ where: { id: surveyId } });

    res.status(200).json({ message: "Survey and associated questions deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting survey:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const surveyResponsesAsJsonOrCsv = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const { format = "json" } = req.query;

    const responses = await Responses.findAll({
      where: { surveyId },
      include: [
        { model: Question, attributes: ["text", "type"] },
        { model: User, attributes: ["firstName", "email"] },
      ],
    });

    if (!responses.length) {
      return res.status(404).json({ message: "No responses found for this survey." });
    }

    const jsonData = responses.map((resp) => ({
      userName: resp.User?.firstName || "Unknown",
      email: resp.User?.email || "N/A",
      question: resp.Question?.text || "N/A",
      questionType: resp.Question?.type || "N/A",
      answer: Array.isArray(resp.answer) ? resp.answer.join(", ") : resp.answer,
      status: resp.status,
      statusSubmitted: resp.statusSubmitted,
      createdOn: resp.createdAt,
      updatedOn: resp.updatedAt,
    }));

    // ✅ CSV Export
    const convertJsonToCsv = (data) => {
      const keys = Object.keys(data[0]);
      const csvRows = [
        keys.join(","), // Header
        ...data.map((row) =>
          keys
            .map((key) => {
              const value = row[key];
              return `"${typeof value === "string" ? value.replace(/"/g, '""') : JSON.stringify(value)}"`;
            })
            .join(",")
        ),
      ];
      return csvRows.join("\n");
    };

    if (format === "csv") {
      const csv = convertJsonToCsv(jsonData);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=survey-${surveyId}.csv`);
      return res.send(csv);
    }

    // ✅ JSON Export
    if (format === "json") {
      const jsonString = JSON.stringify(jsonData, null, 2);
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename=survey-${surveyId}.json`);
      return res.send(jsonString);
    }

    // ✅ Excel Export
    // if (format === "xlsx") {
    //   const workbook = new ExcelJS.Workbook();
    //   const worksheet = workbook.addWorksheet("Survey Responses");

    //   worksheet.columns = Object.keys(jsonData[0]).map((key) => ({
    //     header: key,
    //     key,
    //     width: 25,
    //   }));

    //   jsonData.forEach((row) => worksheet.addRow(row));

    //   res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    //   res.setHeader("Content-Disposition", `attachment; filename=survey-${surveyId}.xlsx`);

    //   return workbook.xlsx.write(res).then(() => res.end());
    // }

    return res.status(400).json({ message: "Invalid format type." });
  } catch (error) {
    console.error("❌ Error exporting survey responses:", error);
  }
}
export const blockUserByAdmin = async (req, res) => {
  try {
    const token = req.header("Authorization");
    if (!token) return res.status(401).json({ message: "Unauthorized: No token provided" });

    const decoded = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);
    const admin = await Admin.findByPk(decoded.id);
    if (!admin || admin.status !== "active") {
      return res.status(403).json({ message: "Access denied: Invalid admin" });
    }

    const { userId } = req.params;
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    await user.update({ status: "blocked" });

    res.status(200).json({ message: "User has been blocked successfully." });
    io.emit("userLoginStatus", { userId, isLoggedIn: false });

  } catch (error) {
    console.error("❌ Error blocking user:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

export const loginNucleusAdmin = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find admin by email
    const admin = await Admin.findOne({ where: { email } });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Check password
    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: admin.id, email: admin.email },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '1d' }
    );

    // Prepare admin object for frontend mapping
    const responseAdmin = {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.global_role || 'None',
      department: admin.departments?.[0] || 'Unknown',
    };

    return res.json({ token, admin: responseAdmin });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
}

export const unblockUserByAdmin = async (req, res) => {
  try {
    const token = req.header("Authorization");
    if (!token) return res.status(401).json({ message: "Unauthorized: No token provided" });

    const decoded = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);
    const admin = await Admin.findByPk(decoded.id);
    if (!admin || admin.status !== "active") {
      return res.status(403).json({ message: "Access denied: Invalid admin" });
    }

    const { userId } = req.params;
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    await user.update({ status: "Inactive" });
    io.emit("userLoginStatus", { userId, isLoggedIn: true });

    res.status(200).json({ message: "User has been blocked successfully." });
  } catch (error) {
    console.error("❌ Error blocking user:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

export const deleteUserByAdmin = async (req, res) => {
  try {
    const token = req.header("Authorization");
    if (!token) return res.status(401).json({ message: "Unauthorized: No token provided" });

    const decoded = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);
    const admin = await Admin.findByPk(decoded.id);
    if (!admin || admin.status !== "active") {
      return res.status(403).json({ message: "Access denied: Invalid admin" });
    }

    const { userId } = req.params;
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    
    let email= user.email;
    await user.destroy();
    await BetaUsers.destroy({ where: { email } });

    res.status(200).json({ message: "User deleted successfully." });
    io.emit("userLoginStatus", { userId, isLoggedIn: false, deleted: true });

  } catch (error) {
    console.error("❌ Error deleting user:", error);
    res.status(500).json({ message: "Server error", error });
  }
}

export const assignRoleAndTags = async (req, res) => {
  const { targetUserId, departmentCode, roleType, tags = [] } = req.body;
  const adminId = req.user?.id;

  try {
    const department = await Department.findOne({ where: { code: departmentCode } });
    if (!department) return res.status(404).json({ message: 'Department not found' });

    const [record, created] = await UserDepartment.upsert({
      userId: targetUserId,
      departmentId: department.id,
      roleType,
      tags,
    }, {
      returning: true,
      conflictFields: ['userId', 'departmentId'],
    });

    await RoleAssignmentLog.create({
      userId: targetUserId,
      departmentId: department.id,
      assignedBy: adminId,
      roleType,
      tags,
      actionType: created ? 'assigned' : 'modified',
      timestamp: new Date(),
    });

    await AdminActionLog.create({
      performedBy: adminId,
      actionType: 'assign_role',
      objectType: 'user',
      objectId: targetUserId,
      notes: `Assigned ${roleType} role in ${departmentCode} with tags: ${tags.join(', ')}`,
    });

    return res.status(200).json({ message: 'Role and tags assigned successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error assigning role/tags' });
  }
};

export const revokeRoleAndTags = async (req, res) => {
  const { targetUserId, departmentCode } = req.body;
  const adminId = req.user?.id;

  try {
    const department = await Department.findOne({ where: { code: departmentCode } });
    if (!department) return res.status(404).json({ message: 'Department not found' });

    const deleted = await UserDepartment.destroy({
      where: { userId: targetUserId, departmentId: department.id },
    });

    if (deleted) {
      await RoleAssignmentLog.create({
        userId: targetUserId,
        departmentId: department.id,
        assignedBy: adminId,
        roleType: null,
        tags: [],
        actionType: 'revoked',
        timestamp: new Date(),
      });

      await AdminActionLog.create({
        performedBy: adminId,
        actionType: 'revoke_role',
        objectType: 'user',
        objectId: targetUserId,
        notes: `Revoked all roles/tags in ${departmentCode}`,
      });
    }

    return res.status(200).json({ message: 'Role and tags revoked' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error revoking role/tags' });
  }
};


export const getAdminActionLogs = async (req, res) => {
  const { departmentId, objectType, actionType, limit = 50 } = req.query;
  const requesterId = req.user.id;

  try {
    const isFounderOrSuperadmin = await Admin.findOne({
      where: {
        id: requesterId,
        global_role: { [Op.in]: ['Founder', 'Superadmin'] },
      },
    });

    const whereClause = {};
    if (objectType) whereClause.objectType = objectType;
    if (actionType) whereClause.actionType = actionType;

    // Department filter (if needed for scoped logs)
    if (departmentId && !isFounderOrSuperadmin) {
      whereClause.notes = { [Op.iLike]: `%${departmentId}%` }; // crude filter unless you normalize department
    }

    const logs = await AdminActionLog.findAll({
      where: whereClause,
      order: [['timestamp', 'DESC']],
      limit: parseInt(limit),
    });

    return res.status(200).json({ logs });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to retrieve admin logs' });
  }
};



export const getAdminProfile = async (req, res) => {
  try {
    const adminId = req.admin?.id;
    const context = await getAdminContext(adminId);

    return res.status(200).json({
      id: context.adminId,
      name: context.name,
      email: context.email,
      globalRole: context.globalRole,
      isFounder: context.isFounder,
      isSuperadmin: context.isSuperadmin,
      departments: context.departments, // Array of { id, name, code, roleType, tags }
    });
  } catch (err) {
    console.error('Error fetching admin profile:', err);
    return res.status(500).json({ message: 'Failed to load profile' });
  }
};

export const superAdminCreationByFounder = async (req, res) =>{
  try {
      const { adminName, adminEmail, adminPassword, adminRole }  = req.body;
      if (!req.admin || !req.admin.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const { id } = req.user;
      var admin = await Admin.findOne({ where: { id } })

      const existingAdmin = await Admin.findOne({ where: { email: adminEmail } });
      if (existingAdmin) {
        return res.status(400).json({ message: "Admin with this email already exists." });
      }

      if(admin.global_role=="Founder"){
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        const superAdmin = await Admin.create({
          name: adminName,
          email: adminEmail,
          password: hashedPassword,
          global_role: adminRole,
        });

        return res.status(201).json({ message: `${adminRole} created by Founder.`, admin: superAdmin });
      }
      return res.status(403).json({ message: "You do not have permission to create an admin." });
  } catch (error) {
    console.error("Error creating admin:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
}

export const getAllSuperAdmins = async (req, res) => {
  try {
    if (!req.admin || req.admin.role !== 'Founder') {
      return res.status(403).json({ message: "Access denied: Only founders can view this list" });
    }

    const superAdmins = await Admin.findAll({
      where: { global_role: 'Superadmin' },
      attributes: ['id', 'name', 'email','status', 'createdAt','global_role'],
    });

    if (!superAdmins.length) {
      return res.status(404).json({ message: "No Superadmins found" });
    }

    return res.status(200).json(superAdmins);
  }
  catch (error) {
    console.error("Error fetching superadmins:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
}

export const DepartmentCreationByFounder = async(req,res)=>{
  try {
    const { name, code } = req.body;
    
    if (!req.admin || !req.admin.role || !req.admin.id) {
      return res.status(401).json({ message: "Unauthorized: Invalid or missing token" });
    }

    if (req.admin.role !== "Founder") {
      return res.status(403).json({ message: "Access denied: Only Founders can create departments" });
    }

    if(!name||!code) return res.status(400).json({message: "Missing Department Name or Department Code"});
    const existingDepartment = await Department.findOne({
      where: {
        [Op.or]: [{ name }, { code }],
      },
    });

    if (existingDepartment) {
      console.log("Existing Department:", existingDepartment);
      return res.status(409).json({
        message: `Department with the same ${existingDepartment.name === name ? 'name' : 'code'} already exists`,
      });
    }

    await Department.create({ name, code});
    return res.json({message: `Department ${name} created successfully`})
  } catch (error) {
    console.error("Error creating department:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message})
  }
}

export const verifyAdminToken = (req, res, next) => {
  try {
    const token = req.cookies?.admin_token; // 👈 Expecting cookie named "admin_token"

    if (!token) {
      return res.status(401).json({ message: "Unauthorized - No token found" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded; // Attach decoded admin payload to request
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};


export const activeSuperAdmins = async (req, res) => {
  try {
    if (!req.admin || !req.admin.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const superAdmins = await Admin.findAll({
      where: { global_role: 'Superadmin', status: 'active' },
      attributes: ['id', 'name', 'email', 'createdAt'],
    });

    if (!superAdmins.length) {
      return res.status(404).json({ message: "No active Superadmins found" });
    }

    return res.status(200).json(superAdmins);
  } catch (error) {
    console.error("Error fetching active superadmins:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
}

export const getAllDepartments = async (req, res) => {
  try {
    if (!req.admin || (req.admin.role !== 'Founder' && req.admin.role !== 'Superadmin')) {
      return res.status(403).json({ message: "Access denied: Only Founder or Superadmin can access this" });
    }

    const departments = await Department.findAll({
      where: { parentId: null },
      attributes: ['id', 'name', 'code'],
      // include: [{
      //   model: Admin,
      //   as: 'head',
      //   attributes: ['name', 'email']
      // }]
    });

    if (!departments.length) {
      return res.status(404).json({ message: "No departments found" });
    }

    return res.status(200).json(departments);
  } catch (error) {
    console.error("Error fetching departments:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
}

export const toggleSuperadminStatus  = async (req, res) => {
  try {

    if (!req.admin || req.admin.role !== "Founder") {
      return res.status(403).json({ message: "Access denied: Only Founders can perform this action" });
    }

    const { superAdminId } = req.params;
    const superAdmin = await Admin.findByPk(superAdminId);
    console.log('role',superAdmin, superAdminId);

    if (!superAdmin || superAdmin.global_role !== 'Superadmin') {
      return res.status(404).json({ message: "Superadmin not found" });
    }

    const newStatus = superAdmin.status === 'active' ? 'disabled' : 'active';

    await superAdmin.update({ status: newStatus });

    return res.status(200).json({
      message: `Superadmin has been ${newStatus === 'active' ? 'enabled' : 'disabled'} successfully.`,
      newStatus,
    });
  } catch (error) {
    console.error("Error disabling superadmin:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
}

export const deleteSuperAdmin = async (req, res) => {
  try {

    if (!req.admin || req.admin.role !== "Founder") {
      return res
        .status(403)
        .json({ message: "Access denied: Only Founders can delete Superadmins" });
    }

    const { superAdminId } = req.params;
    const superAdmin = await Admin.findByPk(superAdminId);

    console.log('role',superAdmin.global_role);

    if (!superAdmin || superAdmin.global_role !== 'Superadmin') {
      return res.status(404).json({ message: "Superadmin not found" });
    }

    await superAdmin.destroy();

    return res.status(200).json({ message: "Superadmin has been deleted successfully." });
  } catch (error) {
    console.error("Error deleting superadmin:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
}

export const subDepartmentCreation = async(req, res)=>{
  try {
    const {role,id} = req.user;
    if (role !== 'Founder' && role!== "Superadmin") return res.status(403).json({ message: "Access denied: Invalid founder email" });
    const {name, code} = req.body;
    const { parentId } = req.params;
    if(!name||!code || !parentId) return res.status(400).json({message: "Missing sub Department Name or Sub Department Code or parent"});
    const parentDepartment = await Department.findByPk(parentId);
    if (!parentDepartment) {
      return res.status(404).json({ message: "Parent department not found" });
    }
    if (parentDepartment.parentId !== null) {
      return res.status(400).json({ message: "Cannot create a sub-department under another sub-department." });
    }
    const existingDepartment = await Department.findOne({
      where: {
        parentId,
        name,
      },
    });

    if (existingDepartment) {
      return res.status(409).json({
        message: `Department with the same ${existingDepartment.name === name ? 'name' : 'code'} already exists`,
      });
    }
    const subDepartment = await Department.create({
      name,
      code,
      // parentId,
      // headId: id, // Founder creating it
      // status: "active"
    });
    return res.status(201).json({
      message: `Sub-department '${name}' created successfully under '${parentDepartment.name}'`,
      subDepartment,
    });
  } catch (error) {
    console.log("Error adding subdepartment",error.message);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
}

export const getSubDepartments = async(req,res)=>{
  try {
    if (!req.admin || (req.admin.role !== "Founder" && req.admin.role !== "Superadmin")) {
      return res.status(403).json({ message: "Access denied: Only Founder or Superadmin can view subdepartments" });
    }
    const { parentId } = req.params;
    if (!parentId) return res.status(400).json({ message: "Missing parent Department Id" });
    const subDepartments = await Department.findAll({
      where: { parentId },
      attributes: ['id', 'name', 'code'
        // , 'headId', 'parentId', 'status'
      ],
      order: [['createdAt', 'ASC']],
    });

    if(subDepartments.length!=0){

      return res.status(200).json(subDepartments); // ✅ send plain array
    }
    return res.status(404).json({message: "No subdepartments here"})

  } catch (error) {
    console.log("Error adding subdepartment",error.message);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
}

export const toggleSubDepartmentStatus = async(req,res)=>{
  try {
    if (!req.admin || (req.admin.role !== "Superadmin" && req.admin.role !== "Founder")) {
      return res.status(403).json({ message: "Access denied: Only Superadmin or Founder can change department status" });
    }

    const { parentId } = req.params;
    if (!parentId) return res.status(400).json({ message: "Missing department ID" });

    const subDepartment = await Department.findByPk(parentId);
    if (!subDepartment) return res.status(404).json({ message: "Department not found" });

    subDepartment.status = subDepartment.status === "active" ? "disabled" : "active";
    await subDepartment.save();
    console.log("subDepartment", subDepartment.status);
    return res.status(200).json({
      message: `Department has been ${subDepartment.status === 'active' ? 'enabled' : 'disabled'} successfully.`,
      subDepartment,
    });
  } catch (error) {
    console.log("Error changing status", error.message);
    return res.status(500).json({ message: "Internal Server Error", error: error.message});
  }
}

export const deleteSubDepartment = async(req,res)=>{
  try {
    if (!req.admin || (req.admin.role !== "Superadmin" && req.admin.role !== "Founder")) {
      return res.status(403).json({ message: "Access denied: Only Superadmin or Founder can delete subdepartments" });
    }
    const { subdeptid } = req.params;
    if (!subdeptid) {
      return res.status(400).json({ message: "Missing subdepartment ID" });
    }
    const subDepartment = await Department.findByPk(subdeptid);
    if (!subDepartment) return res.status(404).json({ message: "Sub Department not found" });

    await subDepartment.destroy();
    return res.status(200).json({ message: "Sub-department has been deleted successfully." });
  } catch (error) {
    console.log("Error deleting subdepartment", error.message);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
}

export const updateDepartment = async (req, res) => {
  try {
    if (!req.admin || (req.admin.role !== "Superadmin" && req.admin.role !== "Founder")) {
      return res.status(403).json({ message: "Access denied: Only Superadmin or Founder can update departments" });
    }
    const { departmentId } = req.params;
    const { name, code, status } = req.body;

    const department = await Department.findByPk(departmentId);
    if (!department) return res.status(404).json({ message: "Department not found" });

    // Update only provided fields
    if (name) department.name = name;
    if (code) department.code = code;
    if (status) department.status = status;

    await department.save();

    return res.status(200).json({ message: "Department updated successfully", department });
  } catch (error) {
    console.error("Error updating department:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
}

export const createRoleDeptwise = async (req, res) => {
  try {
    if (!req.admin || (req.admin.role !== 'Superadmin' && req.admin.role !== 'Founder')) {
      return res.status(403).json({ message: "Access denied: Only Superadmin or Founder can create roles" });
    }

    const { name } = req.body;
    const { departmentId } = req.params;

    if (!name || !departmentId) {
      return res.status(400).json({ message: "Role name and department ID are required" });
    }

    const department = await Department.findByPk(departmentId);
    if (!department) {
      return res.status(404).json({ message: "Department not found" });
    }

    // Check if the role already exists
    const existingRole = await UserDepartment.findOne({
      where: { departmentId, role: name, status: 'active' },
    });

    if (existingRole) {
      return res.status(409).json({ message: "Role already exists in this department" });
    }

    // Create the new role
    const newRole = await UserDepartment.create({
      roleId: uuidv4(),
      departmentId,
      role: name,
      headId: id, // Assuming the creator is the head
      tags: [],
    });

    return res.status(201).json({ message: "Role created successfully", role: newRole });
  } catch (error) {
    console.error("Error creating role:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
}

export const getRolesByDepartment = async (req, res) => {
  try {
    if (!req.admin || (req.admin.role !== 'Superadmin' && req.admin.role !== 'Founder')) {
      return res.status(403).json({ message: "Access denied" });
    }
    const { departmentId } = req.params;

    const roles = await UserDepartment.findAll({
      where: { departmentId },
      attributes: ['role','roleId', 'headId', 'tags', 'status']
    });

    if (!roles.length) {
      return res.status(404).json({ message: "No roles found for this department" });
    }

    return res.status(200).json(roles);
  } catch (error) {
    console.error("Error fetching roles:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
}

export const deleteDepartmentRole = async (req, res) => {
  try {
    if (!req.admin || (req.admin.role !== 'Superadmin' && req.admin.role !== 'Founder')) {
      return res.status(403).json({ message: "Access denied" });
    }
    const { roleId } = req.params;

    if (!roleId) {
      return res.status(400).json({ message: 'Missing roleId in request params' });
    }

    const role = await UserDepartment.findOne({ where: { roleId } });

    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    await role.destroy();

    return res.status(200).json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Error deleting role:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

export const toggleRoleStatus = async (req, res) => {
  try {

    if (!req.admin || (req.admin.role !== 'Superadmin' && req.admin.role !== 'Founder')) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { roleId } = req.params;
    const { status } = req.body;

    if (!roleId || !['active', 'disabled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid roleId or status' });
    }

    const role = await UserDepartment.findOne({ where: { roleId } });

    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    role.status = status;
    await role.save();

    return res.status(200).json({ message: `Role status updated to ${status}` });
  } catch (error) {
    console.error('Error toggling role status:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

export const addSubDepartmentRole = async (req, res) => {
  try {
    if (!req.admin || (req.admin.role !== 'Superadmin' && req.admin.role !== 'Founder')) {
      return res.status(403).json({ message: "Access denied" });
    }
    const { subDepartmentId } = req.params;
    const { role, headId, tags, roleType } = req.body;

    if (!role || !roleType) {
      return res.status(400).json({ message: 'Role and roleType are required' });
    }

    const newRole = await UserDepartment.create({
      roleId: uuidv4(),         // assuming roleId is UUID PK
      departmentId: subDepartmentId,
      role,
      headId: headId || null,
      tags: tags || [],
      roleType,
      status: 'active',         // default status on creation
    });

    return res.status(201).json({ message: 'Role created successfully', data: newRole });
  } catch (error) {
    console.error('Error creating sub-department role:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};


export const getSubDepartmentRoles = async (req, res) => {
  try {

    if (!req.admin || (req.admin.role !== 'Superadmin' && req.admin.role !== 'Founder')) {
      return res.status(403).json({ message: "Access denied" });
    }
    const { subDepartmentId } = req.params;

    const roles = await UserDepartment.findAll({
      where: { departmentId: subDepartmentId },
      attributes: ['roleId', 'role', 'headId', 'tags', 'status', 'roleType'],
      order: [['createdAt', 'ASC']],
    });

    return res.status(200).json(roles);
  } catch (error) {
    console.error('Error fetching sub-department roles:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

export const editSuperadminPassword = async (req, res) => {
  try {
    if (!req.admin || (req.admin.role !== 'Superadmin' && req.admin.role !== 'Founder')) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ message: "newPassword is required" });
    }

    const admin = await Admin.findByPk(id);
    if (!admin || admin.global_role !== "Superadmin") {
      return res.status(404).json({ message: "Superadmin not found" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await admin.update({ password: hashed });

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("editSuperadminPassword error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};


export const fetchChildrenWithStats = async (req, res) => {
  try {
    let { parent_id } = req.params;
    if (parent_id === "null" || parent_id === null) parent_id = null;

    const children = await CatalogueNode.findAll({
      where: { parent_id },
      attributes: [
        "node_id",
        "name",
        "node_level",
        "is_domain",
        "is_subject",
        "is_topic",
      ],
      order: [["name", "ASC"]],
      raw: true,
    });

    const detailedChildren = await Promise.all(
      children.map(async (node) => {
        const totalSessions = await Session.count({
          where: { topic_id: node.node_id },
        });

        const summary = await FeedbackSummary.findOne({
          where: { node_id: node.node_id },
          attributes: ["avg_star_rating", "feedback_count"],
          raw: true,
        });

        let avgRating = 0;
        if (summary?.feedback_count > 0) {
          avgRating = summary.avg_star_rating;
        } else {
          const raw = await Feedback.findOne({
            where: { topic_id: node.node_id },
            attributes: [
              [Sequelize.fn("AVG", Sequelize.col("star_rating")), "avg_star_rating"],
            ],
            raw: true,
          });
          avgRating = raw?.avg_star_rating || 0;
        }

        const tierStats = await Teachertopicstats.findAll({
          where: { node_id: node.node_id },
          attributes: [
            "level",
            [Sequelize.fn("COUNT", Sequelize.col("level")), "total_sessions"],
          ],
          group: ["level"],
          raw: true,
        });

        const result = { ...node, totalSessions, avgRating, tiers: tierStats };

        if (node.is_topic) {
          const bridgers = await Teachertopicstats.findAll({
            where: { node_id: node.node_id },
            attributes: ["teacher_id", "level"],
            include: [
              {
                model: User,
                as: "teacher",
                attributes: ["firstName", "lastName", "profilePictureUrl"],
              },
            ],
            raw: true,
          });

          result.bridgers = bridgers.map((b) => ({
            teacher_id: b.teacher_id,
            name: `${b["teacher.firstName"] || ""} ${b["teacher.lastName"] || ""}`.trim(),
            profilePictureUrl: b["teacher.profilePictureUrl"] || null,
            level: b.level,
            totalSessions: 0,
            avgRating: 0,
          }));
        }

        return result;
      })
    );

    return res.status(200).json(detailedChildren);
  } catch (error) {
    console.error("❌ fetchChildrenWithStats error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};



const getYesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const getUsersSummary = async (req, res) => {
  try {
    if (!req.admin || (req.admin.role !== 'Superadmin' && req.admin.role !== 'Founder')) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const yesterday = getYesterday();

    // Total across all levels
    const totalUsers = await User.count();
    const newUsersYesterday = await User.count({
      where: { createdAt: { [Op.gte]: yesterday } },
    });

    // Breakdown by levels
    const levels = ["Bridger", "Expert", "Master", "Legend"];
    const breakdown = {};

    for (const level of levels) {
      const count = await Teachertopicstats.count({
        include: [{ model: User, as: "teacher", attributes: [] }],
        where: { level },
      })

      const newSinceYesterday = await Teachertopicstats.count({
        include: [{ model: User, as: "teacher", attributes: [] }],
        where: {
          level,
          createdAt: { [Op.gte]: yesterday },
        },
      });

      breakdown[level.toLowerCase()] = {
        total: count,
        changeFromYesterday: newSinceYesterday,
      };
    }

    return res.json({
      users: {
        totalUsers,
        changeFromYesterday: newUsersYesterday,
      },
      bridgers: breakdown.bridger,
      experts: breakdown.expert,
      masters: breakdown.master,
      legends: breakdown.legend,
    });
  } catch (err) {
    console.error("❌ Error fetching summary:", err);
    res.status(500).json({ error: "Failed to fetch users summary" });
  }
};

// toggleSyncDb.js

let currentMode = "development"; // default mode at startup
const SECURE_SYNC_PIN = "secure";

export const toggleSyncDb = async (req, res) => {
  try {
    const { pin, isSyncNeeded, mode } = req.body;

    const isDevMode = Boolean(mode === "development");
    const incomingMode = isDevMode ? "development" : "production";

    // Validate PIN if in dev mode
    if (isDevMode && pin !== SECURE_SYNC_PIN) {
      return res.status(403).json({ message: "Access denied: Invalid PIN" });
    }

    console.log(`[${incomingMode.toUpperCase()} MODE] Sync request received. isSyncNeeded: ${isSyncNeeded}`);

    // Temporarily change mode
    currentMode = incomingMode;

    // Run sync operation
    await runDbSync(isSyncNeeded);

    // Revert mode to dev
    currentMode = "development";
    console.log("✅ Full database sync completed successfully and reverted back to ⏭️ Skip Sync.");

    const responsePayload = {
      message: isSyncNeeded
          ? "✅ Full database sync completed successfully and reverted back to ⏭️ Skip Sync."
          : "⏭️ Sync skipped as requested. No changes made.",
      modeBeforeSync: incomingMode,
      modeAfterSync: currentMode,
    };

    // ✅ Only include this flag if full sync was done
    if (isSyncNeeded === true) {
      responsePayload.shouldResetSync = true;
    }

    return res.status(200).json(responsePayload);

  } catch (error) {
    console.error("❌ Error toggling DB sync:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};




// ✅ GET: Fetch all cooldown data for all users (test-wise)
export const getAllCooldownsForAllUsers = async (req, res) => {
  try {
    const users = await User.findAll();
    const data = [];

    for (const user of users) {
      const tests = await Test.findAll({
        where: { user_id: user.id },
        order: [["submitted_at", "DESC"]],
      });

      for (const test of tests) {
        let topicName = null;
        let topicPath = null;

        if (test.topic_uuid) {
          const topic = await CatalogueNode.findOne({
            where: { node_id: test.topic_uuid },
          });

          if (topic) {
            topicName = topic.name;
            topicPath = topic.address_of_node ?? null;
          }
        }

        data.push({
          user_id: user.id,
          name: `${user.firstName}`.trim(),
          email: user.email,
          latest_test_id: test.test_id, // match frontend expectation
          topic_uuid: test.topic_uuid,
          topic_name: topicName,
          topic_path: topicPath,
          submitted_at: test.submitted_at,
          latest_cooldown: test.cooling_period ?? null,
        });
      }
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error("❌ Error fetching all cooldowns:", err);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};



// ✅ PUT: Update cooling_period for selected tests
export const updateCoolDownPeriod = async (req, res) => {
  try {
    const { testIds = [], cooling_period = 0 } = req.body;

    if (!Array.isArray(testIds) || testIds.length === 0) {
      return res.status(400).json({ success: false, message: "No test IDs provided" });
    }

    const [affectedRows] = await Test.update(
      { cooling_period },
      {
        where: {
          test_id: testIds,
        },
      }
    );

    res.json({
      success: true,
      updated_count: affectedRows,
      message: `${affectedRows} test(s) updated successfully.`,
    });
  } catch (err) {
    console.error("❌ Error updating cooldowns:", err);
    res.status(500).json({ success: false, message: "Update failed" });
  }
};

