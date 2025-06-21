import express from "express";
import { CatalogueController } from "../controllers/CatalogueController.js";

const router = express.Router();

// ✅ Fetch categories (top-level nodes)
router.get("/categories", CatalogueController.getCategories);

// ✅ Fetch Education Levels under a Category
router.get("/education/:categoryId", CatalogueController.getEducation);

// ✅ Fetch Boards under an Education Level
router.get("/boards/:educationId", CatalogueController.getBoards);

// ✅ Fetch Grades under a Board
router.get("/grades/:boardId", CatalogueController.getGrades);

// ✅ Fetch Subjects under a Grade
router.get("/subjects/:gradeId", CatalogueController.getSubjects);

// ✅ Fetch Topics under a Subject
router.get("/topics/:subjectId", CatalogueController.getTopics);

// ✅ Fetch Full Hierarchy
router.get("/hierarchy", CatalogueController.getFullHierarchy);

export default router;
