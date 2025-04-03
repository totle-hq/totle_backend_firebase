import { Grade } from "../../Models/CatalogModels/GradeModel.js";
import { Subject } from "../../Models/CatalogModels/SubjectModel.js";

// ✅ Fetch all subjects (excluding soft-deleted ones)
export const getAllSubjects = async (req, res) => {
  try {
    const subjects = await Subject.findAll();
    res.status(200).json(subjects);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch subjects" });
  }
};

// ✅ Fetch a single subject by ID
export const getSubjectById = async (req, res) => {
  try {
    const subject = await Subject.findByPk(req.params.id);
    if (!subject) return res.status(404).json({ error: "Subject not found" });
    res.status(200).json(subject);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch subject" });
  }
};

// ✅ Fetch subjects by Grade ID
export const getSubjectsByGrade = async (req, res) => {
  try {
    const subjects = await Subject.findAll({
      where: { gradeId: req.params.gradeId },
    });
    res.status(200).json(subjects);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch subjects" });
  }
};

// ✅ Create a new subject
export const createSubject = async (req, res) => {
  try {
    const { name, description, gradeId } = req.body;

    // Check if Grade exists before creating Subject
    const grade = await Grade.findByPk(gradeId);
    if (!grade) return res.status(400).json({ error: "Invalid grade ID" });

    const newSubject = await Subject.create({ name, description, gradeId });
    res.status(201).json(newSubject);
  } catch (error) {
    res.status(500).json({ error: "Failed to create subject" });
  }
};

// ✅ Update an existing subject
export const updateSubject = async (req, res) => {
  try {
    const { name, description } = req.body;
    const subject = await Subject.findByPk(req.params.id);

    if (!subject) return res.status(404).json({ error: "Subject not found" });

    await subject.update({ name, description });
    res.status(200).json(subject);
  } catch (error) {
    res.status(500).json({ error: "Failed to update subject" });
  }
};

// ✅ Soft delete a subject
export const deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findByPk(req.params.id);
    if (!subject) return res.status(404).json({ error: "Subject not found" });

    await subject.destroy(); // Soft delete
    res.status(200).json({ message: "Subject deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete subject" });
  }
};

// ✅ Restore a soft-deleted subject
export const restoreSubject = async (req, res) => {
  try {
    const subject = await Subject.findByPk(req.params.id, { paranoid: false });
    if (!subject) return res.status(404).json({ error: "Subject not found" });

    await subject.restore(); // Restore soft-deleted subject
    res.status(200).json({ message: "Subject restored successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to restore subject" });
  }
};
