import { Category } from "../../Models/CategoryModel.js";
import { Education } from "../../Models/EducationModel.js";


// ✅ Fetch all education institutions (excluding soft-deleted ones)
export const getAllEducation = async (req, res) => {
  try {
    const educationList = await Education.findAll();
    res.status(200).json(educationList);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch education institutions" });
  }
};

// ✅ Fetch a single education institution by ID
export const getEducationById = async (req, res) => {
  try {
    const education = await Education.findByPk(req.params.id);
    if (!education) return res.status(404).json({ error: "Education institution not found" });
    res.status(200).json(education);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch education institution" });
  }
};

// ✅ Fetch education institutions by Category ID
export const getEducationByCategory = async (req, res) => {
  try {
    const educationList = await Education.findAll({
      where: { categoryId: req.params.categoryId },
    });
    res.status(200).json(educationList);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch education institutions" });
  }
};

// ✅ Create a new education institution
export const createEducation = async (req, res) => {
  try {
    const { name, categoryId } = req.body;

    // Check if Category exists before creating Education
    const category = await Category.findByPk(categoryId);
    if (!category) return res.status(400).json({ error: "Invalid category ID" });

    const newEducation = await Education.create({ name, categoryId });
    res.status(201).json(newEducation);
  } catch (error) {
    res.status(500).json({ error: "Failed to create education institution" });
  }
};

// ✅ Update an existing education institution
export const updateEducation = async (req, res) => {
  try {
    const { name } = req.body;
    const education = await Education.findByPk(req.params.id);

    if (!education) return res.status(404).json({ error: "Education institution not found" });

    await education.update({ name });
    res.status(200).json(education);
  } catch (error) {
    res.status(500).json({ error: "Failed to update education institution" });
  }
};

// ✅ Soft delete an education institution
export const deleteEducation = async (req, res) => {
  try {
    const education = await Education.findByPk(req.params.id);
    if (!education) return res.status(404).json({ error: "Education institution not found" });

    await education.destroy(); // Soft delete
    res.status(200).json({ message: "Education institution deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete education institution" });
  }
};

// ✅ Restore a soft-deleted education institution
export const restoreEducation = async (req, res) => {
  try {
    const education = await Education.findByPk(req.params.id, { paranoid: false });
    if (!education) return res.status(404).json({ error: "Education institution not found" });

    await education.restore(); // Restore soft-deleted education institution
    res.status(200).json({ message: "Education institution restored successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to restore education institution" });
  }
};
