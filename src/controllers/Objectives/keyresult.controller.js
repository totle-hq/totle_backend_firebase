// controllers/Objectives/keyresult.controller.js

import { KeyResult } from '../../Models/Objectives/keyresult.model.js';
import { Objective } from '../../Models/Objectives/objective.model.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger.js';

/**
 * @route POST /api/objectives/:objectiveId/key-results
 * @desc Create a new Key Result
 */
export const createKeyResult = async (req, res) => {
  try {
    const { objectiveId } = req.params;
    const { description, progress } = req.body;

    const objective = await Objective.findByPk(objectiveId);
    if (!objective) {
      return res.status(404).json({ success: false, message: 'Objective not found' });
    }

    const latestOrder = await KeyResult.max('order', { where: { objectiveId } }) || 0;

    const keyResult = await KeyResult.create({
      keyResultId: uuidv4(),
      objectiveId,
      description,
      progress: Number(progress) || 0,
      order: latestOrder + 1,
    });

    return res.status(201).json({ success: true, data: keyResult });
  } catch (error) {
    logger.error('Failed to create key result:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
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
      order: [['order', 'ASC']],
    });

    return res.status(200).json({ success: true, data: results });
  } catch (error) {
    logger.error('Failed to fetch key results:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
