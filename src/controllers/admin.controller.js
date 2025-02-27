
// import { userDb } from "../config/prismaClient.js";
import {Admin} from '../models/AdminModel.js';
import {Blog} from '../models/BlogModel.js';
import {Survey} from '../models/SurveyModel.js';
import {Responses} from '../models/ResponsesModel.js';
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

    res.status(200).json({message: "Successfully Logged in!", token, admin:{name: admin.name, email: admin.email} });
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

    await userDb.blog.delete({ where: { id } });

    res.json({ message: "Blog deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};


import multer from "multer";
import path from "path";
import fs from "fs";

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
    const users = await userDb.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isVerified: true,
        status: true,
        preferredLanguage: { select: { language_name: true } },
        location: true,
        mobile: true,
        currentOccupation: true,
        skills: true,
        isLoggedIn: true
      },
    });

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

export const createSurvey = async (req, res) => {
  try {
    console.log("Received survey data:", req.body);
    const { title, questions } = req.body;

    if (!title || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "Title and questions are required" });
    }

    const survey = await Survey.create({
        title,
        questions: {
          create: questions.map(q => ({
            text: q.text,
            type: q.type,
            options: q.options || [],
          })),
        },
      include: { questions: true },
    });

    res.status(201).json({ message: "Survey created successfully", survey });
  } catch (error) {
    console.error("Error creating survey:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


// ✅ Get All Surveys
export const getAllSurveys = async (req, res) => {
  try {
    const surveys = await Survey.findAll({ 
      select: { 
        id: true, 
        title: true,
        questions: {   // Include questions
          select: {
            id: true,
            text: true,
            type: true,
            options: true
          }
        }
      } 
    });
    res.status(200).json(surveys);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};


// ✅ Get Survey Results
export const getSurveyResults = async (req, res) => {
  try {
    const { surveyId } = req.params;

    const survey = await Survey.findOne({
      where: { id: surveyId },
      include: [
        {
          model: Question,
          attributes: ['id', 'text', 'type'],
        },
        {
          model: Responses,
          attributes: ['questionId', 'answer'],
        },
      ],
    });

    if (!survey) {
      return res.status(404).json({ message: "Survey not found" });
    }

    // Organize data in the expected format
    const results = survey.questions.map((question) => {
      const responses = survey.responses
        .filter((response) => response.questionId === question.id)
        .map((r) => r.answer);

      // Count responses for multiple-choice questions
      const responseCounts =
        question.type === "multiple-choice" || question.type === "single-choice"
          ? responses.reduce((acc, curr) => {
              acc[curr] = (acc[curr] || 0) + 1;
              return acc;
            }, {})
          : responses;

      return {
        question: question.text,
        type: question.type,
        responses: responseCounts,
      };
    });

    res.status(200).json(results);
  } catch (error) {
    console.error("Error fetching survey results:", error);
    res.status(500).json({ message: "Server error", error });
  }
};


// ✅ Submit a Survey Response
export const submitSurveyResponse = async (req, res) => {
  try {
    const { surveyId } = req.params;
    const { responses } = req.body;
    const token = req.header("Authorization"); // ✅ Get token from headers

    if (!token) {
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    console.log("Received token:", token); // ✅ Debug log for token

    // ✅ Verify and decode JWT token
    let decoded;
    try {
      decoded = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);
      console.log("Decoded token:", decoded); // ✅ Log decoded token
    } catch (error) {
      console.error("JWT verification error:", error);
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }

    const userId = decoded.id; // ✅ Extract user ID from token

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User ID missing from token" });
    }

    if (!surveyId || !responses || !responses.length) {
      return res.status(400).json({ message: "Survey ID and responses are required" });
    }

    // ✅ Validate if the survey exists
    const surveyExists = await Survey.findOne({ where: { id: surveyId } });
    if (!surveyExists) {
      return res.status(404).json({ message: "Invalid survey ID" });
    }

    await Promise.all(
      responses.map(async (response) => {
        await Response.create({
            survey: { connect: { id: surveyId } },
            question: { connect: { id: response.questionId } },
            user: { connect: { id: userId } }, // ✅ Ensure user is connected correctly
            answer: response.answer,
          },
        );
      })
    );

    res.status(201).json({ message: "Survey submitted successfully" });
  } catch (error) {
    console.error("Error submitting survey:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
