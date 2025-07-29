import { Objective } from '../../Models/Objectives/objective.model.js';
import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';

// Generate next Objective code (e.g., OBJ-0001, OBJ-0002, etc.)
const generateObjectiveCode = async () => {
  const latest = await Objective.findOne({
    order: [['createdAt', 'DESC']],
  });

  let nextNumber = 1;
  if (latest && latest.objectiveCode) {
    const match = latest.objectiveCode.match(/OBJ-(\d+)/);
    if (match) nextNumber = parseInt(match[1], 10) + 1;
  }

  return `OBJ-${String(nextNumber).padStart(4, '0')}`;
};

// ✅ Create Objective
export const createObjective = async (req, res) => {
  try {
    const { title, level = 1, createdBy } = req.body;

    if (!title || !createdBy) {
      return res.status(400).json({ message: 'Title and createdBy are required' });
    }

    const objectiveCode = await generateObjectiveCode();

    const newObjective = await Objective.create({
      objectiveId: uuidv4(),
      title,
      level,
      objectiveCode,
      createdBy,
    });

    res.status(201).json({ message: 'Objective created successfully', data: newObjective });
  } catch (error) {
    console.error('❌ Error creating objective:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
};

// ✅ Get All Objectives (optionally by level)
export const getAllObjectives = async (req, res) => {
  try {
    const { level } = req.query;
    const whereClause = level ? { level: parseInt(level, 10) } : {};

    const objectives = await Objective.findAll({
      where: whereClause,
      order: [['createdAt', 'ASC']],
    });

    res.status(200).json({ data: objectives });
  } catch (error) {
    console.error('❌ Error fetching objectives:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
};

// ✅ Get Objective by ID
export const getObjectiveById = async (req, res) => {
  try {
    const { id } = req.params;

    const objective = await Objective.findOne({
      where: {
        [Op.or]: [
          { objectiveId: id },
          { objectiveCode: id },
        ],
      },
    });

    if (!objective) {
      return res.status(404).json({ message: 'Objective not found' });
    }

    res.status(200).json({ data: objective });
  } catch (error) {
    console.error('❌ Error fetching objective by ID:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
};

// ✅ Update Objective
export const updateObjective = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, level } = req.body;

    const objective = await Objective.findOne({
      where: {
        [Op.or]: [
          { objectiveId: id },
          { objectiveCode: id },
        ],
      },
    });

    if (!objective) {
      return res.status(404).json({ message: 'Objective not found' });
    }

    objective.title = title ?? objective.title;
    objective.level = level ?? objective.level;

    await objective.save();

    res.status(200).json({ message: 'Objective updated successfully', data: objective });
  } catch (error) {
    console.error('❌ Error updating objective:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
};

// ✅ Archive Objective (soft delete)
export const archiveObjective = async (req, res) => {
  try {
    const { id } = req.params;

    const objective = await Objective.findOne({
      where: {
        [Op.or]: [
          { objectiveId: id },
          { objectiveCode: id },
        ],
      },
    });

    if (!objective) {
      return res.status(404).json({ message: 'Objective not found' });
    }

    objective.isArchived = true;
    await objective.save();

    res.status(200).json({ message: 'Objective archived successfully' });
  } catch (error) {
    console.error('❌ Error archiving objective:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
};

// ❌ Hard Delete Objective
export const deleteObjective = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Objective.destroy({
      where: {
        [Op.or]: [{ objectiveId: id }, { objectiveCode: id }],
      },
    });

    if (deleted === 0) {
      return res.status(404).json({ message: 'Objective not found' });
    }

    res.status(200).json({ message: 'Objective permanently deleted' });
  } catch (error) {
    console.error('❌ Error deleting objective:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
};

