// utils/get-admin-context.js
import { Admin } from '../Models/UserModels/AdminModel.js';
import { UserDepartment } from '../Models/UserModels/UserDepartment.js';
import { Department } from '../Models/UserModels/Department.js';

export async function getAdminContext(adminId) {
  const admin = await Admin.findByPk(adminId);
  if (!admin) throw new Error('Admin not found');

  const isFounder = admin.global_role === 'Founder';
  const isSuperadmin = admin.global_role === 'Superadmin';

  const userDepts = await UserDepartment.findAll({
    where: { userId: adminId },
    include: [{ model: Department }],
  });

  const departments = userDepts.map((entry) => ({
    id: entry.departmentId,
    code: entry.department?.code,
    name: entry.department?.name,
    roleType: entry.roleType,
    tags: entry.tags,
  }));

  return {
    adminId,
    name: admin.name,
    email: admin.email,
    globalRole: admin.global_role,
    isFounder,
    isSuperadmin,
    departments,
  };
}
