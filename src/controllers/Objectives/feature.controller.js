// controllers/Objectives/feature.controller.js

import { sequelize1 } from "../../config/sequelize.js";
import { Epic } from "../../Models/Objectives/epics.model.js";
import { Feature } from "../../Models/Objectives/Feature.model.js";
import { Op } from 'sequelize'; 
import logger from "../../utils/logger.js";

// ✅ Create Feature
export const createFeature = async (req, res) => {
  try {
    const { epicId } = req.params;
    const { featureName, status } = req.body;

    const epic = await Epic.findByPk(epicId);
    if (!epic) {
      return res.status(404).json({ success: false, message: 'Epic not found' });
    }
       const highestPriorityfeature = await Feature.findOne({
          where: { epicId },
          order: [['priority', 'ASC']],
        });
    
        const newPriority = highestPriorityfeature ? highestPriorityfeature.priority + 1 : 1;
    

    const feature = await Feature.create({ featureName, status, epicId, featureCode: '',priority: newPriority }); 

    return res.status(201).json({ success: true, data: feature });
  } catch (error) {
    logger.error('Failed to create feature:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ✅ Get all Features under an Epic
export const getFeaturesByEpic = async (req, res) => {
  try {
    const { epicId } = req.params;

    const features = await Feature.findAll({ where: { epicId },
       order: [['priority', 'ASC']] });

    return res.status(200).json({ success: true, data: features });
  } catch (error) {
    logger.error('Failed to fetch features:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ✅ Update Feature
export const updateFeature = async (req, res) => {
  try {
    const { epicId, featureId } = req.params;
    const { featureName, status } = req.body;

    const feature = await Feature.findOne({ where: { featureId, epicId } });
    if (!feature) {
      return res.status(404).json({ success: false, message: 'Feature not found' });
    }

    feature.featureName = featureName ?? feature.featureName;
    feature.status = status ?? feature.status;
    await feature.save();

    return res.status(200).json({ success: true, data: feature });
  } catch (error) {
    logger.error('Failed to update feature:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ✅ Delete Feature
export const deleteFeature = async (req, res) => {
  try {
    const { epicId, featureId } = req.params;

    const feature = await Feature.findOne({ where: { featureId, epicId } });
    if (!feature) {
      return res.status(404).json({ success: false, message: 'Feature not found' });
    }

    await feature.destroy();

    return res.status(200).json({ success: true, message: 'Feature deleted' });
  } catch (error) {
    logger.error('Failed to delete feature:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// 👈 you need this import

export const updatefeaturePriority = async (req, res) => {
  try {
    const { featureId } = req.params;
    const { newPriority } = req.body;

    const feature = await Feature.findByPk(featureId);

    if (!feature) {
      return res.status(404).json({ message: 'Feature not found' });
    }

    const oldPriority = feature.priority;

    if (newPriority === oldPriority) {
      return res.status(200).json({ message: 'Priority unchanged', data: feature });
    }

    const t = await sequelize1.transaction();

    try {
      // 👇 Fix: Only update features under the same epicId
      if (newPriority < oldPriority) {
        await Feature.update(
          { priority: sequelize1.literal('priority + 1') },
          {
            where: {
              epicId: feature.epicId,
              priority: {
                [Op.gte]: newPriority,
                [Op.lt]: oldPriority,
              },
            },
            transaction: t,
          }
        );
      } else {
        await Feature.update(
          { priority: sequelize1.literal('priority - 1') },
          {
            where: {
              epicId: feature.epicId,
              priority: {
                [Op.lte]: newPriority,
                [Op.gt]: oldPriority,
              },
            },
            transaction: t,
          }
        );
      }

      // Update the selected feature
      feature.priority = newPriority;
      await feature.save({ transaction: t });

      await t.commit();

      return res.status(200).json({ message: 'Priority updated successfully', data: feature });
    } catch (err) {
      await t.rollback();
      console.error('Transaction failed:', err);
      return res.status(500).json({ message: 'Failed to update priority' });
    }
  } catch (error) {
    console.error('❌ Error updating feature priority:', error);
    return res.status(500).json({ message: 'Internal server error', error });
  }
};

