import { Category } from "../../Models/CategoryModel.js";
import { Education } from "../../Models/EducationModel.js";
import { Board } from "../../Models/BoardModel.js";
import { Grade } from "../../Models/GradeModel.js";
import { Subject } from "../../Models/SubjectModel.js";
import { Topic } from "../../Models/TopicModel.js";

export class CatalogueController {
  // ✅ Fetch all top-level categories
  static async getCategories(req, res) {
    try {
      const categories = await Category.findAll();
      res.status(200).json(categories);
    } catch (error) {
      res.status(500).json({ message: "Error fetching categories", error });
    }
  }

  // ✅ Fetch Education levels under a Category
  static async getEducation(req, res) {
    try {
      const { categoryId } = req.params;
      const education = await Education.findAll({ where: { parent_id: categoryId } });
      res.status(200).json(education);
    } catch (error) {
      res.status(500).json({ message: "Error fetching education levels", error });
    }
  }

  // ✅ Fetch Boards under an Education Level
  static async getBoards(req, res) {
    try {
      const { educationId } = req.params;
      const boards = await Board.findAll({ where: { parent_id: educationId } });
      res.status(200).json(boards);
    } catch (error) {
      res.status(500).json({ message: "Error fetching boards", error });
    }
  }

  // ✅ Fetch Grades under a Board
  static async getGrades(req, res) {
    try {
      const { boardId } = req.params;
      const grades = await Grade.findAll({ where: { parent_id: boardId } });
      res.status(200).json(grades);
    } catch (error) {
      res.status(500).json({ message: "Error fetching grades", error });
    }
  }

  // ✅ Fetch Subjects under a Grade
  static async getSubjects(req, res) {
    try {
      const { gradeId } = req.params;
      const subjects = await Subject.findAll({ where: { parent_id: gradeId } });
      res.status(200).json(subjects);
    } catch (error) {
      res.status(500).json({ message: "Error fetching subjects", error });
    }
  }

  // ✅ Fetch Topics under a Subject
  static async getTopics(req, res) {
    try {
      const { subjectId } = req.params;
      const topics = await Topic.findAll({ where: { parent_id: subjectId } });
      res.status(200).json(topics);
    } catch (error) {
      res.status(500).json({ message: "Error fetching topics", error });
    }
  }

  // ✅ Fetch Full Hierarchy (For Bulk Fetching)
  static async getFullHierarchy(req, res) {
    try {
      const categories = await Category.findAll({
        include: [
          {
            model: Education,
            include: [
              {
                model: Board,
                include: [
                  {
                    model: Grade,
                    include: [
                      {
                        model: Subject,
                        include: [{ model: Topic }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });

      res.status(200).json(categories);
    } catch (error) {
      res.status(500).json({ message: "Error fetching full hierarchy", error });
    }
  }
}
