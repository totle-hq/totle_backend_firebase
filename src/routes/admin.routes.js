import express from "express";

import { adminLogin, createBlog, createSurvey, deleteBlog, getAdminBlogs, getAdminDetails, getAllBlogs, getAllSurveys, getAllUsers, getBlogById, getSurveyResults, submitSurveyResponse, updateBlog, uploadImage } from "../controllers/admin.controller.js";
import { loginLimiter } from "../middlewares/rateLimiter.js";
import { authenticateAdmin } from "../middlewares/adminMiddleware.js";
const router = express.Router();
import multer from "multer";
import path from "path";

// Setup Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "src/uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });


router.post("/login", loginLimiter, adminLogin);
router.get("/auth/me", getAdminDetails);
router.post("/blogs", authenticateAdmin, createBlog);       // Create a blog (Admin only)
router.get("/blogs", getAllBlogs);                          // Get all blogs (Public)
router.get("/blogs/:id", getBlogById);                      // Get a single blog (Public)
router.get("/blogs", authenticateAdmin, getAdminBlogs); // Get blogs created by logged-in admin
router.put("/blogs/:id", authenticateAdmin, updateBlog);    // Update a blog (Only by author admin)
router.delete("/blogs/:id", authenticateAdmin, deleteBlog); // Delete a blog (Only by author admin)
router.post("/upload", upload.single("image"), uploadImage); // Upload image (Admin only)
router.get('/users',getAllUsers);
router.post("/surveys", createSurvey);
router.get("/surveys", getAllSurveys);
router.get("/surveys/:surveyId/results", getSurveyResults);
router.post("/surveys/:surveyId/responses", submitSurveyResponse);

export default router;


