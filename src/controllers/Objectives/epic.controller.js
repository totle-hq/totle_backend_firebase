// controllers/Objectives/epic.controller.js

import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger.js';
import { KeyResult } from '../../Models/Objectives/keyresult.model.js';
import { Epic } from '../../Models/Objectives/epics.model.js'; // ✅ corrected path
import { sequelize1 } from '../../config/sequelize.js';
import { Op } from 'sequelize';

// ✅ Create Epic
export const createEpic = async (req, res) => {
  try {
    const { keyResultId } = req.params;
    const { epicName, status } = req.body;

    const keyResult = await KeyResult.findByPk(keyResultId);
    if (!keyResult) {
      return res.status(404).json({ success: false, message: 'Key Result not found' });
    }
console.log("Creating epic with keyResultId:", keyResultId);
const highestPriorityEpic = await Epic.findOne({
  where: { keyResultId },
  order: [['priority', 'ASC']],
});

const newPriority = highestPriorityEpic ? highestPriorityEpic.priority + 1 : 1;
    const epic = await Epic.create({
      epicId: uuidv4(),
      keyResultId,
      epicCode: '', // Will be generated in the model hook
      epicName,
      status,
      priority: newPriority,
    });

    return res.status(201).json({ success: true, data: epic });
  } catch (error) {
    logger.error('Failed to create epic:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

const isUUID = (str) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};
// ✅ Get Epic by ID
export const getEpicById = async (req, res) => {
  try {
    const { id } = req.params;

    let whereClause;

    if (isUUID(id)) {
      whereClause = {epicId: id };
    } else {
      whereClause = { epicCode: id };
    }

    const epic = await Epic.findOne({ where: whereClause });

    if (!epic) {
      return res.status(404).json({ message: 'epic not found' });
    }

    res.status(200).json({ data: epic });
  } catch (error) {
    console.error('❌ Error fetching objective:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
};



// ✅ Get Epics by KeyResult
export const getEpicsByKeyResult = async (req, res) => {
  try {
    const { keyResultId } = req.params;

    const epics = await Epic.findAll({
      where: { keyResultId },
      order: [['priority', 'DESC']],
    });

    return res.status(200).json({ success: true, data: epics });
  } catch (error) {
    logger.error('Failed to fetch epics:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// ✅ Update Epic
export const updateEpic = async (req, res) => {
  try {
    const { keyResultId, epicId } = req.params;
    const { epicName, status } = req.body;

    const epic = await Epic.findOne({ where: { epicId, keyResultId } });
    if (!epic) {
      return res.status(404).json({ success: false, message: 'Epic not found' });
    }

    epic.epicName = epicName ?? epic.epicName;
    epic.status = status ?? epic.status;
    await epic.save();

    return res.status(200).json({ success: true, data: epic, message: 'Epic updated successfully' });
  } catch (error) {
    logger.error('Failed to update epic:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

// ✅ Delete Epic
export const deleteEpic = async (req, res) => {
  try {
    const { keyResultId, epicId } = req.params;

    const epic = await Epic.findOne({ where: { epicId, keyResultId } });
    if (!epic) {
      return res.status(404).json({ success: false, message: 'Epic not found' });
    }

    await Epic.destroy({ where: { epicId } });

    return res.status(200).json({ success: true, message: 'Epic deleted successfully' });
  } catch (error) {
    logger.error('Failed to delete epic:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
// controllers/Objectives/epic.controller.js

export const updateEpicStatus = async (req, res) => {
  try {
    const { epicId } = req.params;
    const { status } = req.body;

    // Validate status value
    const allowedStatuses = ['to-do', 'inProgress', 'done', 'review'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const epic = await Epic.findByPk(epicId);
    if (!epic) {
      return res.status(404).json({ success: false, message: 'Epic not found' });
    }

    epic.status = status;
    await epic.save();

    return res.status(200).json({ success: true, data: epic, message: 'Status updated successfully' });
  } catch (error) {
    console.error('Failed to update epic status:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};


// update the Epic priority
export const updateEpicpriority = async (req, res) => {
  try {
    const { epicId } = req.params;
    const { newPriority } = req.body;

    const epic = await Epic.findByPk(epicId);

    if (!epic) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const oldPriority = epic.priority;

    if (newPriority === oldPriority) {
      return res.status(200).json({ message: 'Priority unchanged', data: epic});
    }

    // Start a transaction
    const t = await sequelize1.transaction();

    try {
      if (newPriority < oldPriority) {
   
        await Epic.update(
          { priority: sequelize1.literal('priority + 1') },
          {
            where: {
                keyResultId: epic.keyResultId, 
              priority: {
                [Op.gte]: newPriority,
                [Op.lt]: oldPriority,
              },
            },
            transaction: t,
          }
        );
      } else {
     
        await Epic.update(
          { priority: sequelize1.literal('priority - 1') },
          {
            where: {
                keyResultId: epic.keyResultId,
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
      epic.priority = newPriority;
      await epic.save({ transaction: t });

      await t.commit();

      return res.status(200).json({ message: 'Priority updated successfully', data: epic });
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