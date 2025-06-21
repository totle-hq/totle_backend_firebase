
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

export const updateAdminStatus = async (adminId, status) => {
  return await Admin.update({ status }, { where: { id: adminId } }); // Sequelize Admin model
};



export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await findAdminByEmail(email);

    if (!admin) return res.status(400).json({ message: "Admin not found" });

    if (admin.status !== "active") {
      return res.status(403).json({ message: "Admin account is inactive. Contact Super Admin." });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: admin.id, name: admin.name, status: admin.status, email: admin.email }, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.status(200).json({message: "Successfully Logged in!", token, admin:{name: admin.name, email: admin.email, id: admin.id} });
    io.emit("userLoginStatus", { userId: admin.id, isLoggedIn: true });

  } catch (error) {
    res.status(500).json({ message: "Server error", error });
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


import multer from "multer";
import path, { format } from "path";
import fs from "fs";
import { MarketplaceSuggestion } from '../../Models/SurveyModels/MarketplaceModel.js';
import { type } from 'os';
import { BetaUsers } from '../../Models/UserModels/BetaUsersModel.js';

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