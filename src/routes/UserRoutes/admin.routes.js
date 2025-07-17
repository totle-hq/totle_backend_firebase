import express from "express";

import { activeSuperAdmins, adminLogin, assignRoleAndTags, blockUserByAdmin, createBlog, createOrUpdateSurvey, deleteBlog, deleteSuperAdmin, deleteSurveyById, deleteUserByAdmin, DepartmentCreationByFounder, displayQuestionsBySurveyId, getAdminActionLogs, getAdminBlogs, getAdminDetails, getAdminProfile, getAllBlogs, getAllDepartments, getAllSuggestionsForAdmin, getAllSuperAdmins, getAllSurveys, getAllUsers, getBlogById, getQuestionsBySurveyId, getResultsBySurveyId, getSurveyNames, getSurveyResults, revokeRoleAndTags, submitSurveyResponse, superAdminCreationByFounder, surveyResponsesAsJsonOrCsv, toggleSuperadminStatus, unblockUserByAdmin, updateBlog, uploadImage, verifyAdminToken } from "../../controllers/UserControllers/admin.controller.js";
import { authenticateAdmin } from "../../middlewares/adminMiddleware.js";
import { loginLimiter } from "../../middlewares/rateLimiter.js";
const router = express.Router();
import multer from "multer";
import path from "path";
import { create } from "domain";
import { checkAdminAccess } from "../../middlewares/checkAdminAccess.js";

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
router.get("/auth/me", getAdminProfile);
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
router.post("/create/superAdmin",verifyAdminToken, superAdminCreationByFounder);
router.get("/get/superadmins",verifyAdminToken, getAllSuperAdmins);
router.get("/org/superadmins", verifyAdminToken, activeSuperAdmins);
router.put("/org/superadmins/:superAdminId/toggle", verifyAdminToken, toggleSuperadminStatus);
router.delete("/org/superadmins/:superAdminId", verifyAdminToken, deleteSuperAdmin)
router.post("/org/departments", verifyAdminToken, DepartmentCreationByFounder);
router.get("/org/departments",verifyAdminToken, getAllDepartments);


router.post(
  '/assign',
  checkAdminAccess({ requiredRole: 'manage' }), // Founder/Superadmin override handled inside
  assignRoleAndTags
);

router.post(
  '/revoke',
  checkAdminAccess({ requiredRole: 'manage' }),
  revokeRoleAndTags
);

router.get(
  '/',
  checkAdminAccess({ requiredRole: 'manage' }),
  getAdminActionLogs
);

// Nucleus admin
// router.post("/nucleus",loginNucleusAdmin)
export default router;


