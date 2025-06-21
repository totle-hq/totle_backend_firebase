import { Board } from "../../Models/CatalogModels/BoardModel.js";
import { Education } from "../../Models/CatalogModels/EducationModel.js";


// ✅ Fetch all boards (excluding soft-deleted ones)
export const getAllBoards = async (req, res) => {
  try {
    const boards = await Board.findAll();
    res.status(200).json(boards);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch boards" });
  }
};

// ✅ Fetch a single board by ID
export const getBoardById = async (req, res) => {
  try {
    const board = await Board.findByPk(req.params.id);
    if (!board) return res.status(404).json({ error: "Board not found" });
    res.status(200).json(board);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch board" });
  }
};

// ✅ Fetch boards by Education ID
export const getBoardsByEducation = async (req, res) => {
  try {
    const boards = await Board.findAll({
      where: { eduId: req.params.eduId },
    });
    res.status(200).json(boards);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch boards" });
  }
};

// ✅ Create a new board
export const createBoard = async (req, res) => {
  try {
    const { name, description, eduId } = req.body;

    // Check if Education exists before creating Board
    const education = await Education.findByPk(eduId);
    if (!education) return res.status(400).json({ error: "Invalid education ID" });

    const newBoard = await Board.create({ name, description, eduId });
    res.status(201).json(newBoard);
  } catch (error) {
    res.status(500).json({ error: "Failed to create board" });
  }
};

// ✅ Update an existing board
export const updateBoard = async (req, res) => {
  try {
    const { name, description } = req.body;
    const board = await Board.findByPk(req.params.id);

    if (!board) return res.status(404).json({ error: "Board not found" });

    await board.update({ name, description });
    res.status(200).json(board);
  } catch (error) {
    res.status(500).json({ error: "Failed to update board" });
  }
};

// ✅ Soft delete a board
export const deleteBoard = async (req, res) => {
  try {
    const board = await Board.findByPk(req.params.id);
    if (!board) return res.status(404).json({ error: "Board not found" });

    await board.destroy(); // Soft delete
    res.status(200).json({ message: "Board deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete board" });
  }
};

// ✅ Restore a soft-deleted board
export const restoreBoard = async (req, res) => {
  try {
    const board = await Board.findByPk(req.params.id, { paranoid: false });
    if (!board) return res.status(404).json({ error: "Board not found" });

    await board.restore(); // Restore soft-deleted board
    res.status(200).json({ message: "Board restored successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to restore board" });
  }
};
