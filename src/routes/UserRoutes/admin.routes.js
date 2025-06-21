import express from "express";

<<<<<<< HEAD:src/routes/admin.routes.js
import { adminLogin, createBlog, createOrUpdateSurvey, deleteBlog, deleteSurveyById, displayQuestionsBySurveyId, getAdminBlogs, getAdminDetails, getAllBlogs, getAllSuggestionsForAdmin, getAllSurveys, getAllUsers, getBlogById, getQuestionsBySurveyId, getResultsBySurveyId, getSurveyNames, getSurveyResults, loginNucleusAdmin, submitSurveyResponse, surveyResponsesAsJsonOrCsv, updateBlog, uploadImage } from "../controllers/admin.controller.js";
import { loginLimiter } from "../middlewares/rateLimiter.js";
import { authenticateAdmin } from "../middlewares/adminMiddleware.js";
=======
import { adminLogin, blockUserByAdmin, createBlog, createOrUpdateSurvey, deleteBlog, deleteSurveyById, deleteUserByAdmin, getAdminBlogs, getAdminDetails, getAllBlogs, getAllSuggestionsForAdmin, getAllSurveys, getAllUsers, getBlogById, getQuestionsBySurveyId, getResultsBySurveyId, getSurveyNames, getSurveyResults, submitSurveyResponse, unblockUserByAdmin, updateBlog, uploadImage } from "../../controllers/UserControllers/admin.controller.js";
import { loginLimiter } from "../../middlewares/rateLimiter.js";
import { authenticateAdmin } from "../../middlewares/adminMiddleware.js";
>>>>>>> sequelize_trail:src/routes/UserRoutes/admin.routes.js
const router = express.Router();
import multer from "multer";
import path from "path";
import { create } from "domain";

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


router.post("/login", adminLogin);
router.get("/auth/me", getAdminDetails);
router.post("/blogs", authenticateAdmin, createBlog);       // Create a blog (Admin only)
router.get("/blogs", getAllBlogs);                          // Get all blogs (Public)
router.get("/blogs/:id", getBlogById);                      // Get a single blog (Public)
router.get("/blogs", getAdminBlogs); // Get blogs created by logged-in admin
router.put("/blogs/:id", authenticateAdmin, updateBlog);    // Update a blog (Only by author admin)
router.delete("/blogs/:id", authenticateAdmin, deleteBlog); // Delete a blog (Only by author admin)
router.post("/upload", upload.single("image"), uploadImage); // Upload image (Admin only)
router.get('/users',getAllUsers);
router.post("/surveys", createOrUpdateSurvey);
router.put("/surveys/:surveyId", createOrUpdateSurvey);
router.get("/surveys", getAllSurveys);
router.get("/surveyNames", getSurveyNames)
router.get("/surveys/questions/:surveyId", getQuestionsBySurveyId);
router.get("/usersurveys/questions/:surveyId", displayQuestionsBySurveyId);

router.get("/surveys/surveyResults", getSurveyResults);
router.get("/surveys/surveyResults/:surveyId", getResultsBySurveyId);
router.get("/surveyData/:surveyId", surveyResponsesAsJsonOrCsv);
router.post("/surveys/:surveyId/responses", submitSurveyResponse);
router.get("/getSuggestions", getAllSuggestionsForAdmin);
router.delete("/surveys/:surveyId", deleteSurveyById);
router.post("/block/:userId", blockUserByAdmin);
router.post("/unblock/:userId", unblockUserByAdmin);
router.delete("/deleteUser/:userId", deleteUserByAdmin);

// Nucleus admin
router.post("/nucleus",loginNucleusAdmin)
export default router;


