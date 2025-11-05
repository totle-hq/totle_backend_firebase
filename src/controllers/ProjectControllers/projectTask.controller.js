// src/controllers/ProjectControllers/projectTask.controller.js
import { ProjectTask } from "../../Models/ProjectModels/ProjectTask.model.js";
import { ProjectBoard } from "../../Models/ProjectModels/ProjectBoard.model.js";
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * GET /api/projects/:boardId/tasks
 * List all tasks for a board
 */
export const getTasks = async (req, res) => {
  try {
    const { boardId } = req.params;
    const tasks = await ProjectTask.findAll({
      where: { boardId },
      order: [["createdAt", "ASC"]],
    });
    res.json(tasks);
  } catch (err) {
    console.error("❌ Error fetching tasks:", err);
    res.status(500).json({ message: "Failed to fetch tasks" });
  }
};

/**
 * POST /api/projects/:boardId/tasks
 * Create a new task under a board
 */
export const createTask = async (req, res) => {
  try {
    const { boardId } = req.params;
    const {
      title,
      description,
      criticalLevel = "low",
      assignedTo,
      assignee,
      status,
      priority: frontendPriority,
      imageUrls,
    } = req.body;

    const board = await ProjectBoard.findByPk(boardId);
    if (!board) return res.status(404).json({ message: "Board not found" });

    if (!title || !assignee)
      return res.status(400).json({ message: "Title and assignee are required" });

    // Parse cloudinary image urls from frontend
    const frontendImageUrls =
      typeof imageUrls === 'string'
        ? JSON.parse(imageUrls)
        : Array.isArray(imageUrls)
        ? imageUrls
        : [];

    const criticalToPriority = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };

    const priority = frontendPriority ?? criticalToPriority[criticalLevel] ?? 1;

    const task = await ProjectTask.create({
      title,
      description,
      assignee,
      assignedTo,
      status: status || "to-do",
      criticalLevel,
      priority,
      imageUrls: frontendImageUrls,
      boardId,
    });

    res.status(201).json(task);
  } catch (err) {
    console.error("❌ Error creating task:", err);
    res.status(500).json({ message: "Failed to create task" });
  }
};



/**
 * PUT /api/projects/tasks/:taskId
 * Update an existing task
 */
export const updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, description, assignee, assignedTo, status, criticalLevel, imageUrls, priority: frontendPriority, } = req.body;

    const task = await ProjectTask.findByPk(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const criticalToPriority = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };

    task.title = title ?? task.title;
    task.description = description ?? task.description;
    task.assignee = assignee ?? task.assignee;
    task.status = status.toLowerCase() ?? task.status;
    task.criticalLevel = criticalLevel ?? task.criticalLevel;
    task.imageUrls = imageUrls ?? task.imageUrls;
    task.assignedTo = assignedTo ?? task.assignedTo;
    // 💡 Priority logic: use frontend value or fallback to criticalLevel
    task.priority = frontendPriority ?? criticalToPriority[task.criticalLevel] ?? task.priority ?? 1;

    await task.save();

    res.json(task);
  } catch (err) {
    console.error("❌ Error updating task:", err);
    res.status(500).json({ message: "Failed to update task" });
  }
};

/**
 * DELETE /api/projects/tasks/:taskId
 * Delete a task
 */


// 🧩 Helper function: extract Cloudinary public_id from image URL
const extractPublicId = (url) => {
  const parts = url.split('/');
  const file = parts.pop()?.split('.')[0]; // remove extension
  const folder = parts.slice(parts.indexOf('upload') + 1).join('/');
  return folder ? `${folder}/${file}` : file;
};

// 🧹 Delete Task and associated Cloudinary images
export const deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await ProjectTask.findByPk(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const imageUrls = task.imageUrls || [];

    if (Array.isArray(imageUrls) && imageUrls.length > 0) {
      const publicIds = imageUrls.map(extractPublicId);
      await cloudinary.api.delete_resources(publicIds);
    }

    await task.destroy();
    res.json({ message: "Task and associated images deleted successfully" });
  } catch (err) {
    console.error("❌ Error deleting task:", err);
    res.status(500).json({ message: "Failed to delete task" });
  }
};


export const deleteFromCloudinary = async (req, res) => {
  const publicId = req.params.publicId;

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
    });

    if (result.result === 'ok') {
      return res.status(200).json({ success: true });
    } else if (result.result === 'not found') {
      return res.status(404).json({ success: false, message: 'Image not found' });
    } else {
      return res.status(400).json({ success: false, message: 'Unknown error from Cloudinary' });
    }

  } catch (err) {
    console.error("Cloudinary deletion error:", err);
    res.status(500).json({ error: err.message });
  }
};
