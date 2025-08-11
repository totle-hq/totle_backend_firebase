// controllers/Objectives/keyresult.controller.js

import { KeyResult } from '../../Models/Objectives/keyresult.model.js';
import { Objective } from '../../Models/Objectives/objective.model.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger.js';
import { sequelize1 } from '../../config/sequelize.js';
import { Op } from 'sequelize';


/**
 * @route POST /api/objectives/:objectiveId/key-results
 * @desc Create a new Key Result
 */

export const createKeyResult = async (req, res) => {
  try {
    const { objectiveId } = req.params;
    const { description, progress } = req.body;

    // 1. Find the objective
    const objective = await Objective.findByPk(objectiveId);
    if (!objective) {
      return res.status(404).json({ success: false, message: 'Objective not found' });
    }
   const highestPrioritykeyresult = await KeyResult.findOne({
  where: { objectiveId }, // 👈 local to current objective
  order: [['priority', 'DESC']],
});


    const newPriority = highestPrioritykeyresult ? highestPrioritykeyresult.priority + 1 : 1;


    // 2. Find the latest order
    const latestOrder = (await KeyResult.max('order', { where: { objectiveId } })) || 0;

    // 3. Generate keyResultCode (corrected)
    const count = await KeyResult.count({ where: { objectiveId } }); // ✅ Don't use keyResult.objectiveId
    const next = String(count + 1).padStart(2, '0');
    const keyResultCode = `${objective.objectiveCode.replace('-', '')}-KR${next}`;

    // 4. Create key result
    const keyResult = await KeyResult.create({
      keyResultId: uuidv4(),
      objectiveId,
      description,
      progress: Number(progress) || 0,
      order: latestOrder,
      keyResultCode,
      priority: newPriority,

    });

    return res.status(201).json({ success: true, data: keyResult });
  } catch (error) {
    console.error('Error creating key result:', error);
    logger.error('Failed to create key result:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
// Controller function
const isUUID = (str) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// ✅ Get Objective by ID
export const getKeyResultById = async (req, res) => {
  try {
    const { id } = req.params;

    let whereClause;

    if (isUUID(id)) {
      whereClause = {keyResultId: id };
    } else {
      whereClause = { keyResultCode: id };
    }

    const keyResult = await KeyResult.findOne({ where: whereClause });

    if (!keyResult) {
      return res.status(404).json({ message: 'KeyResult not found' });
    }

    res.status(200).json({ data: keyResult });
  } catch (error) {
    console.error('❌ Error fetching objective:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
};



/**
 * @route GET /api/objectives/:objectiveId/key-results
 * @desc Get all Key Results for a specific Objective
 */
export const getKeyResultsByObjective = async (req, res) => {
  try {
    const { objectiveId } = req.params;

    const results = await KeyResult.findAll({
      where: { objectiveId },
      order: [['priority', 'ASC']],
    });

    return res.status(200).json({ success: true, data: results });
  } catch (error) {
    logger.error('Failed to fetch key results:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
export const deleteKeyResult = async (req, res) => {
  try {
    const { objectiveId, keyResultId } = req.params;

    // Check if the key result exists
    const keyResult = await KeyResult.findOne({
      where: { keyResultId, objectiveId },
    });
    if (!keyResult) {
      return res.status(404).json({ success: false, message: 'Key Result not found' });
    }
    // Delete the key result
    await KeyResult.destroy({
      where: { keyResultId, objectiveId },
    });
    return res.status(200).json({ success: true, message: 'Key Result deleted successfully' });
  } catch (error) {
  
    logger.error('Failed to delete key result:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
    
  }
}
export const updateKeyResult = async (req, res) => {
  try {
    const { objectiveId, keyResultId } = req.params;
    const { description, progress } = req.body;

    // Check if the key result exists
    const keyResult = await KeyResult.findOne({
      where: { keyResultId, objectiveId },
    });
    if (!keyResult) {
      return res.status(404).json({ success: false, message: 'Key Result not found' });
    }
    // Update the key result
    keyResult.description = description ?? keyResult.description;
    keyResult.progress = progress ?? keyResult.progress;
    await keyResult.save();
    return res.status(200).json({ success: true, data: keyResult, message: 'Key Result updated successfully' });

  } catch (error) {
    logger.error('Failed to update key result:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
}

export const updatekeyresultPriority = async (req, res) => {
  try {
    const { keyresultId } = req.params;
    const { newPriority } = req.body;

    const keyResult = await KeyResult.findByPk(keyresultId);

    if (!keyResult) {
      return res.status(404).json({ message: 'Key result not found' });
    }

    const oldPriority = keyResult.priority;

    if (newPriority === oldPriority) {
      return res.status(200).json({ message: 'Priority unchanged', data: keyResult });
    }

    const t = await sequelize1.transaction();

    try {
      if (newPriority < oldPriority) {
        // Increase priorities between newPriority and oldPriority
        await KeyResult.update(
          { priority: sequelize1.literal('priority + 1') },
          {
            where: {
              objectiveId: keyResult.objectiveId,
              priority: {
                [Op.gte]: newPriority,
                [Op.lt]: oldPriority,
              },
            },
            transaction: t,
          }
        );
      } else {
        // Decrease priorities between oldPriority and newPriority
        await KeyResult.update(
          { priority: sequelize1.literal('priority - 1') },
          {
            where: {
              objectiveId: keyResult.objectiveId,
              priority: {
                [Op.lte]: newPriority,
                [Op.gt]: oldPriority,
              },
            },
            transaction: t,
          }
        );
      }

      // Update the key result itself
      keyResult.priority = newPriority;
      await keyResult.save({ transaction: t });

      await t.commit();

      return res.status(200).json({ message: 'Priority updated successfully', data: keyResult });
    } catch (err) {
      await t.rollback();
      console.error('Transaction failed:', err);
      return res.status(500).json({ message: 'Failed to update priority' });
    }
  } catch (error) {
    console.error('❌ Error updating key result priority:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
};
