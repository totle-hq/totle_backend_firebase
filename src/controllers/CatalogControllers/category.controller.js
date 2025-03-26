import { Category } from "../../Models/CategoryModel.js";

// ✅ Fetch all categories (excluding soft-deleted ones)
export const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.findAll();
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
};

// ✅ Fetch a single category by ID
export const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return res.status(404).json({ error: "Category not found" });
    res.status(200).json(category);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch category" });
  }
};

// ✅ Create a new category
export const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    const newCategory = await Category.create({ name, description });
    res.status(201).json(newCategory);
  } catch (error) {
    res.status(500).json({ error: "Failed to create category" });
  }
};

// ✅ Update an existing category
export const updateCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    const category = await Category.findByPk(req.params.id);

    if (!category) return res.status(404).json({ error: "Category not found" });

    await category.update({ name, description });
    res.status(200).json(category);
  } catch (error) {
    res.status(500).json({ error: "Failed to update category" });
  }
};

// ✅ Soft delete a category
export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return res.status(404).json({ error: "Category not found" });

    await category.destroy(); // Soft delete
    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete category" });
  }
};

// ✅ Restore a soft-deleted category
export const restoreCategory = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id, { paranoid: false });
    if (!category) return res.status(404).json({ error: "Category not found" });

    await category.restore(); // Restore soft-deleted category
    res.status(200).json({ message: "Category restored successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to restore category" });
  }
};
