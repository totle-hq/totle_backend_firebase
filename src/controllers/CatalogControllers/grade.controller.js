import { Board } from "../../Models/CatalogModels/BoardModel.js";
import { Grade } from "../../Models/CatalogModels/GradeModel.js";

// ✅ Fetch all grades (excluding soft-deleted ones)
export const getAllGrades = async (req, res) => {
  try {
    const grades = await Grade.findAll();
    res.status(200).json(grades);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch grades" });
  }
};

// ✅ Fetch a single grade by ID
export const getGradeById = async (req, res) => {
  try {
    const grade = await Grade.findByPk(req.params.id);
    if (!grade) return res.status(404).json({ error: "Grade not found" });
    res.status(200).json(grade);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch grade" });
  }
};

// ✅ Fetch grades by Board ID
export const getGradesByBoard = async (req, res) => {
  try {
    const grades = await Grade.findAll({
      where: { boardId: req.params.boardId },
    });
    res.status(200).json(grades);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch grades" });
  }
};

// ✅ Create a new grade
export const createGrade = async (req, res) => {
  try {
    const { name, description, boardId } = req.body;

    // Check if Board exists before creating Grade
    const board = await Board.findByPk(boardId);
    if (!board) return res.status(400).json({ error: "Invalid board ID" });

    const newGrade = await Grade.create({ name, description, boardId });
    res.status(201).json(newGrade);
  } catch (error) {
    res.status(500).json({ error: "Failed to create grade" });
  }
};

// ✅ Update an existing grade
export const updateGrade = async (req, res) => {
  try {
    const { name, description } = req.body;
    const grade = await Grade.findByPk(req.params.id);

    if (!grade) return res.status(404).json({ error: "Grade not found" });

    await grade.update({ name, description });
    res.status(200).json(grade);
  } catch (error) {
    res.status(500).json({ error: "Failed to update grade" });
  }
};

// ✅ Soft delete a grade
export const deleteGrade = async (req, res) => {
  try {
    const grade = await Grade.findByPk(req.params.id);
    if (!grade) return res.status(404).json({ error: "Grade not found" });

    await grade.destroy(); // Soft delete
    res.status(200).json({ message: "Grade deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete grade" });
  }
};

// ✅ Restore a soft-deleted grade
export const restoreGrade = async (req, res) => {
  try {
    const grade = await Grade.findByPk(req.params.id, { paranoid: false });
    if (!grade) return res.status(404).json({ error: "Grade not found" });

    await grade.restore(); // Restore soft-deleted grade
    res.status(200).json({ message: "Grade restored successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to restore grade" });
  }
};
