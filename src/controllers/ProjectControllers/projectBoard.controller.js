// src/controllers/ProjectControllers/projectBoard.controller.js
import { ProjectBoard } from "../../Models/ProjectModels/ProjectBoard.model.js";

/**
 * GET /api/projects/boards
 * List all project boards
 */
export const getBoards = async (req, res) => {
  try {
    const boards = await ProjectBoard.findAll({ order: [["createdAt", "DESC"]] });
    res.json(boards);
  } catch (err) {
    console.error("❌ Error fetching boards:", err);
    res.status(500).json({ message: "Failed to fetch boards" });
  }
};

/**
 * POST /api/projects/boards
 * Create a new project board
 */
export const createBoard = async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ message: "Title is required" });

    const newBoard = await ProjectBoard.create({ title, description });
    res.status(201).json(newBoard);
  } catch (err) {
    console.error("❌ Error creating board:", err);
    res.status(500).json({ message: "Failed to create board" });
  }
};

/**
 * PUT /api/projects/boards/:id
 * Update an existing board
 */
export const updateBoard = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    const board = await ProjectBoard.findByPk(id);
    if (!board) return res.status(404).json({ message: "Board not found" });

    board.title = title ?? board.title;
    board.description = description ?? board.description;
    await board.save();

    res.json(board);
  } catch (err) {
    console.error("❌ Error updating board:", err);
    res.status(500).json({ message: "Failed to update board" });
  }
};

/**
 * DELETE /api/projects/boards/:id
 * Delete a project board (and cascade tasks)
 */
export const deleteBoard = async (req, res) => {
  try {
    const { id } = req.params;

    const board = await ProjectBoard.findByPk(id);
    if (!board) return res.status(404).json({ message: "Board not found" });

    await board.destroy();
    res.json({ message: "Board deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting board:", err);
    res.status(500).json({ message: "Failed to delete board" });
  }
};
