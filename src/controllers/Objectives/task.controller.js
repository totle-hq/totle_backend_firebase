import { Op } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";
import { Feature } from "../../Models/Objectives/Feature.model.js";
import { Task } from "../../Models/Objectives/Task.model.js";
import logger from "../../utils/logger.js";

// ✅ Create a new Task
export const createTask = async (req, res) => {
  try {
    const { featureId } = req.params;
    const { taskName, status } = req.body;

    const feature = await Feature.findByPk(featureId);
    if (!feature) {
      return res.status(404).json({ success: false, message: "Feature not found" });
    }
    const highestPriorityTask = await Task.findOne({
        where: { featureId }, 
      order: [['priority', 'DESC']],
    });

    const newPriority = highestPriorityTask ? highestPriorityTask.priority + 1 : 1;

    const task = await Task.create({ taskName, status, featureId ,taskCode: '',priority: newPriority}); 

    return res.status(201).json({ success: true, data: task });
  } catch (error) {
    logger.error("Error creating task:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ✅ Get all Tasks by Feature
export const getTasksByFeature = async (req, res) => {
  try {
    const { featureId } = req.params;

    const tasks = await Task.findAll({
      where: { featureId },
      order: [["priority", "ASC"]],
    });

    return res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    logger.error("Error fetching tasks:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ✅ Update Task
export const updateTask = async (req, res) => {
  try {
    const { featureId, taskId } = req.params;
    const { taskName, status } = req.body;

    const task = await Task.findOne({ where: { taskId, featureId } });
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    task.taskName = taskName ?? task.taskName;
    task.status = status ?? task.status;
    await task.save();

    return res.status(200).json({ success: true, data: task });
  } catch (error) {
    logger.error("Error updating task:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ✅ Delete Task
export const deleteTask = async (req, res) => {
  try {
    const { featureId, taskId } = req.params;

    const task = await Task.findOne({ where: { taskId, featureId } });
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    await task.destroy();
    return res.status(200).json({ success: true, message: "Task deleted" });
  } catch (error) {
    logger.error("Error deleting task:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// update the priority of a task

export const updateTaskpriority = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { newPriority } = req.body;

    const task = await Task.findByPk(taskId);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const oldPriority = task.priority;

    if (newPriority === oldPriority) {
      return res.status(200).json({ message: 'Priority unchanged', data: task});
    }

    // Start a transaction
    const t = await sequelize1.transaction();

    try {
      if (newPriority < oldPriority) {
     
        await Task.update(
          { priority: sequelize1.literal('priority + 1') },
          {
            where: {
                  featureId: task.featureId,
              priority: {
                [Op.gte]: newPriority,
                [Op.lt]: oldPriority,
              },
            },
            transaction: t,
          }
        );
      } else {
  
        await Task.update(
          { priority: sequelize1.literal('priority - 1') },
          {
            where: {
                  featureId: task.featureId,

              priority: {
                [Op.lte]: newPriority,
                [Op.gt]: oldPriority,
              },
            },
            transaction: t,
          }
        );
      }

      // Update the current objective
      task.priority = newPriority;
      await task.save({ transaction: t });

      await t.commit();

      return res.status(200).json({ message: 'Priority updated successfully', data: task });
    } catch (err) {
      await t.rollback();
      console.error('Transaction failed:', err);
      return res.status(500).json({ message: 'Failed to update priority' });
    }
  } catch (error) {
    console.error('❌ Error updating objective priority:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
};
// Update only status of Task
export const updateTaskStatus = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['to-do', 'inProgress', 'done', 'review'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const task = await Task.findByPk(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    task.status = status;
    await task.save();

    return res.status(200).json({ success: true, data: task, message: 'Status updated successfully' });
  } catch (error) {
    console.error('Failed to update task status:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
