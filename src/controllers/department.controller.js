// src/controllers/department.controller.js
import { Department } from '../Models/department.model.js';

/**
 * GET /api/departments
 * Returns all active (non-deleted) departments.
 */
export const listDepartments = async (req, res) => {
  try {
    const rows = await Department.findAll({
      attributes: ['id', 'name', 'slug', 'description', 'createdAt', 'updatedAt'],
      order: [['name', 'ASC']],
    });
    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('Failed to list departments:', err);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
