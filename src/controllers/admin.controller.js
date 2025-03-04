
// import { userDb } from "../config/prismaClient.js";
import {Admin} from '../Models/AdminModel.js';
import {Blog} from '../Models/BlogModel.js';
import {Survey} from '../Models/SurveyModel.js';
import { User } from '../Models/UserModel.js';
import { Language } from '../Models/LanguageModel.js';
import { Question } from '../Models/QuestionModel.js';
import {Responses} from '../Models/ResponsesModel.js';
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
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
import { MarketplaceSuggestion } from '../Models/MarketplaceModel.js';

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
    const { surveyId, title, questions, adminId } = req.body;

    if (!adminId || !title || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "Admin ID, title, and questions are required" });
    }

    let survey;
    if (surveyId) {
      // ✅ Step 1: If surveyId exists, update the survey
      survey = await Survey.findByPk(surveyId);
      if (!survey) {
        return res.status(404).json({ message: "Survey not found" });
      }
      survey.title = title;
      await survey.save();

      // ✅ Step 2: Delete existing questions (to replace with new ones)
      await Question.destroy({ where: { surveyId: surveyId } });
    } else {
      // ✅ Step 1: Create new survey
      survey = await Survey.create({
        adminId,
        title,
      });
    }

    // ✅ Step 3: Insert new questions into the `questions` table
    const createdQuestions = await Promise.all(
      questions.map(async (q) => {
        let formattedOptions = [];
        if (q.type === "multiple-choice" || q.type === "single-choice") {
          formattedOptions = Array.isArray(q.options) ? q.options : [];
        } else if (q.type === "text") {
          formattedOptions = [];
        } else {
          throw new Error(`Invalid question type: ${q.type}`);
        }

        return await Question.create({
          surveyId: survey.id, // ✅ Link question to the survey
          text: q.text,
          type: q.type,
          options: formattedOptions,
        });
      })
    );

    // ✅ Step 4: Send Response
    res.status(200).json({
      message: surveyId ? "Survey updated successfully" : "Survey created successfully",
      survey,
      questions: createdQuestions,
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
    console.log('userId', userId)

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

    console.log('form', formattedSurveys)
    res.status(200).json(formattedSurveys);
  } catch (error) {
    console.error("❌ Error fetching surveys:", error);
    res.status(500).json({ message: "Server error", error });
  }
};



// ✅ Get Survey Results
export const getSurveyResults = async (req, res) => {
  try {
    const surveyResults = await Survey.findAll({
      attributes: ["id", "title"], // Get survey ID and title
      include: [
        {
          model: Responses,
          attributes: ["userId", "questionId", "answer"], // ✅ Include response details
          required: true, // ✅ Only include surveys that have responses
          include: [
            {
              model: User,
              attributes: ["id", "firstName"], // ✅ Get user details
            },
            {
              model: Question,
              as: "questions",
              attributes: ["id", "text", "type", "options"], // ✅ Get question details
            },
          ],
        },
      ],
    });

    if (!surveyResults.length) {
      return res.status(404).json({ message: "No survey responses found" });
    }

    // ✅ Transform response to structured format
    const formattedResults = surveyResults.flatMap((survey) => 
      (survey.Responses || []).map((response) => ({
        surveyTitle: survey.title,
        username: response.User?.firstName || "Unknown", // ✅ Ensure user exists
        question: response.Question?.text || "Unknown", // ✅ Ensure question exists
        answer:
          response.Question?.type === "multiple-choice"
            ? (Array.isArray(response.answer) ? response.answer : response.answer.split(",")) // ✅ Handle array-based responses
            : response.answer, // ✅ Store as string for single-choice/text responses
      }))
    );

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
      as:"questions",
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
