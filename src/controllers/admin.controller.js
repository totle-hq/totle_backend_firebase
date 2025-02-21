
import { userDb } from "../config/prismaClient.js";
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();


export const createAdmin = async (email, password) => {
  return await userDb.admin.create({
    data: { email, password, status: "active" },
  });
};

export const findAdminByEmail = async (email) => {
  return await userDb.admin.findUnique({ where: { email } });
};

export const updateAdminStatus = async (adminId, status) => {
  return await userDb.admin.update({
    where: { id: adminId },
    data: { status },
  });
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
    const admin = await userDb.admin.findUnique({ where: { id: decoded.id } });

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

    const blog = await userDb.blog.create({
      data: {
        title,
        slug,
        description,
        content,
        image,
        adminId, // Link the blog to the logged-in admin
      },
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
    const blogs = await userDb.blog.findMany({
      include: {
        admin: {
          select: { name: true, email: true }, // Include only name & email of admin
        },
      },
    });

    res.json(blogs);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

export const getBlogById = async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await userDb.blog.findUnique({ where: { id: parseInt(id) } });

    if (!blog) return res.status(404).json({ message: "Blog not found" });

    res.json(blog);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// ✅ Fetch Single Blog by ID
export const getAdminBlogs = async (req, res) => {
  try {
    const adminId = req.admin.id; // Get admin ID from authentication
    console.log('admin id', adminId)

    const blogs = await userDb.blog.findMany({
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

    const blog = await userDb.blog.findUnique({ where: { id } });

    if (!blog) return res.status(404).json({ message: "Blog not found" });
    if (blog.adminId !== adminId) return res.status(403).json({ message: "Unauthorized" });

    const updatedBlog = await userDb.blog.update({
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

    const blog = await userDb.blog.findUnique({ where: { id } });

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

// ✅ Serve Static Files
