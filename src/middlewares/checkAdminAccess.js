// middleware/checkAdminAccess.js
import { UserDepartment } from '../models/UserDepartment.js';
import { Admin } from '../models/AdminModel.js';

/**
 * Middleware to check if the current admin is allowed to perform an action.
 * Usage: checkAdminAccess({ departmentCode: 'tenjiku', requiredRole: 'edit', requiredTags: ['test_gatekeeper'] })
 */
export function checkAdminAccess({ departmentCode, requiredRole = null, requiredTags = [] }) {
  return async (req, res, next) => {
    const adminId = req.user?.id; // Ensure user is set by auth middleware

    if (!adminId) {
      return res.status(401).json({ message: 'Unauthorized: No admin ID' });
    }

    const admin = await Admin.findByPk(adminId);
    if (!admin) return res.status(403).json({ message: 'Admin not found' });

    // Global override
    if (admin.global_role === 'Founder' || admin.global_role === 'Superadmin') {
      return next();
    }

    // Find department ID (you may need to query by code if only code is passed)
    const userDepartments = await UserDepartment.findAll({ where: { userId: adminId } });

    const match = userDepartments.find((entry) => {
      const hasDept = departmentCode ? entry.departmentCode === departmentCode : true;
      const hasRole = !requiredRole || entry.roleType === requiredRole || entry.roleType === 'manage';
      const hasTag = requiredTags.every((tag) => entry.tags.includes(tag));
      return hasDept && hasRole && hasTag;
    });

    if (!match) {
      return res.status(403).json({ message: 'Forbidden: Insufficient access' });
    }

    return next();
  };
}
