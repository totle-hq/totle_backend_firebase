import { Admin } from "../../Models/UserModels/AdminModel.js";
import { Department } from "../../Models/UserModels/Department.js";
import { Role } from "../../Models/UserModels/Roles.Model.js";
import { UserDepartment } from "../../Models/UserModels/UserDepartment.js";
import { autoSeedRolesAndDepartments, seedDepartments, seedRoles } from "../../seeders/roleDeptSeeder.js";
import bcrypt from "bcrypt";
import { sendOtp, verifyOtp } from "../../utils/otpService.js";
import SyncEmail from "../../Models/SyncEmail.model.js";


export const AddDepartments = async (req, res) => {
    try {
        await seedDepartments();
        res.status(201).json({ message: "Departments added successfully" });
    } catch (error) {
        console.error("Error in AddDepartments:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const AddRoles = async (req, res) => {
    try {
        await seedRoles();
        res.status(201).json({ message: "Roles added successfully" });
    } catch (error) {
        console.error("Error in AddRoles:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const autoRolesAndDepartments = async (req = null, res = null) => {
  try {
    await autoSeedRolesAndDepartments();
    if (res) {
      res.status(200).json({ message: "Departments and Roles added successfully" });
    } else {
      console.log("Departments and Roles added successfully (startup)");
    }
  } catch (error) {
    console.error("Error in autoRolesAndDepartments:", error);
    if (res) res.status(500).json({ message: "Internal Server Error" });
  }
};


export const getAllDepartments = async (req, res) => {
    try {
        const departments = await Department.findAll({
            where: { parentId: null},
            order: [['createdAt']],
            attributes: ['id', 'name', 'createdAt', 'updatedAt'],
            include: [{
                model: Department,
                as: 'subDepartments',
                attributes: ['id', 'name', 'createdAt', 'updatedAt'],
            }],
        });
        res.status(200).json(departments);
    }
    catch (error) {
        console.error("Error in getAllDepartments:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};


export const getAllRoles = async (req, res) => {
    try {
        const roles = await Role.findAll({
            order: [['createdAt', 'ASC']],
            // attributes: ['id', 'name','departmentName', 'createdAt', 'updatedAt'],
            attributes: ['id','name']
            // include: [{
            //     model: Department,
            //     attributes: ['id', 'name'],
            // }],
        });
        res.status(200).json(roles);
    } catch (error) {
        console.error("Error in getAllRoles:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const generateProfileBasedOnRole = async (req, res) => {
    try {
    const { id } = req.user;
    const { name,email, departmentCode, password, role } = req.body;

    
    const superAdmin = await Admin.findByPk(id);
    console.info(superAdmin.global_role);
    if (!superAdmin || (superAdmin.global_role !== 'Superadmin' && superAdmin.global_role !== 'Founder')) {
        console.info("Acess denied", superAdmin.global_role)
      return res.status(403).json({ message: "Access denied: Invalid superadmin" });
    }

    if (!name || !departmentCode) {
      return res.status(400).json({ message: "Role name and department ID are required" });
    }

    const department = await Department.findOne({
        where: { code: departmentCode },
        });

    console.info("🔍 department.id:", department.id);

    if (!department) {
      return res.status(404).json({ message: "Department not found" });
    }

    // Check if the role already exists
    const existingRole = await UserDepartment.findOne({
      where: { departmentId: department.id, roleName: role, name: name },
    });

    if (existingRole) {
      return res.status(409).json({ message: "Role already exists in this department" });
    }

    const roleDetails = await Role.findOne({ where: { name: role } });

    if (!roleDetails) {
      return res.status(404).json({ message: "Role not found." });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Create the new role
    const newRole = await UserDepartment.create({
      departmentId: department.id,
      roleName: role, // Use roleName from Role model or fallback to name
    //   department_role_id: roleDetails.id,
      headId: id, // Assuming the creator is the head
      status: 'active', // Default status on creation
      name: name,
      email: email,
      password: hashedPassword,
      tags: [],
    });

    return res.status(201).json({ message: "Role created successfully", role: newRole });
  } catch (error) {
    console.error("Error creating role:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

export const getAllUsersForRoles = async (req, res) => {
    try {
        const { departmentId } = req.params;
        let profiles = await UserDepartment.findAll({
            where: { departmentId },
            order: [['createdAt', 'DESC']],
            attributes: ['roleId', 'name', 'email', 'roleName', 'status', 'departmentId'],
        });
        if (profiles.length === 0) {
            return res.status(404).json({ message: "No profiles found for this department." });
        }
        res.status(200).json(profiles);
    } catch (error) {
        console.error("Error in getAllUsersForRoles:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

function toAccountRow(row, departmentCode) {
  return {
    id: row.roleId,
    name: row.name,
    email: row.email,
    role: row.roleName,
    departmentCode,
  };
}

// GET /nucleus/accounts?departmentCode=TECH
export const getAccountsByDepartmentCode = async (req, res) => {
  try {
    const { departmentCode } = req.query;
    if (!departmentCode) return res.status(400).json({ message: 'departmentCode is required' });

    const dept = await Department.findOne({ where: { code: departmentCode } });
    if (!dept) return res.status(404).json({ message: 'Department not found' });

    const rows = await UserDepartment.findAll({ where: { departmentId: dept.id }, order: [['createdAt', 'DESC']] });
    return res.status(200).json({ accounts: rows.map(r => toAccountRow(r, departmentCode)) });
  } catch (err) {
    console.error('getAccountsByDepartmentCode error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// POST /nucleus/accounts
// body: { name, email, password, departmentCode, role }
export const createAccountInDepartment = async (req, res) => {
  try {
    const { name, email, password, departmentCode, role } = req.body;
    if (!name || !email || !password || !departmentCode || !role) {
      return res.status(400).json({ message: 'name, email, password, departmentCode, role are required' });
    }

    const dept = await Department.findOne({ where: { code: departmentCode } });
    if (!dept) return res.status(404).json({ message: 'Department not found' });

    // Optional: validate role against Roles table if you want strictness
    const validRole = await Role.findOne({ where: { name: role } });
    if (!validRole) return res.status(400).json({ message: `Unknown role: ${role}` });

    const hash = await bcrypt.hash(password, 10);

    const created = await UserDepartment.create({
      name,
      email: email.toLowerCase(),
      password: hash,
      roleName: role,
      departmentId: dept.id,
      status: 'active',
      tags: [],
    });

    return res.status(201).json(toAccountRow(created, departmentCode));
  } catch (err) {
    // handle unique email per department violation
    if (err?.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Email already exists in this department' });
    }
    console.error('createAccountInDepartment error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// PATCH /nucleus/accounts/:id/password
// body: { newPassword }
export const changeAccountPassword = async (req, res) => {
  try {
    const { id } = req.user; // this is roleId (PK)
    // const {id} = req.user;
    const { oldPassword, newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ message: 'newPassword is required' });

    const user = await Admin.findByPk(id);
    if (!user) return res.status(404).json({ message: 'Account not found' });
    
    if (!(await bcrypt.compare(oldPassword, user.password))) {
      return res.status(400).json({ message: "Old password is incorrect" });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hash });
    return res.status(200).json({ message: 'Password updated' });
  } catch (err) {
    console.error('changeAccountPassword error:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};


export const sendOtpForProduction = async (req, res) => {
    try {
        const { email } = req.body;
        let isEmailAllowed = await SyncEmail.isAllowed(email);
        if (!isEmailAllowed) {
          return res
            .status(403)
            .json({ error: true, message: "Email not authorized for Database sync" });
        }
        const otpResponse = await sendOtp(email);
        if (otpResponse.error) {
          return res
            .status(400)
            .json({ error: true, message: otpResponse.message });
        }
        return res.status(200).json({ error: false, message: otpResponse.message });
    }
    catch (error) {
        console.error("Error in sendOtpForProduction:", error);
        res.status(500).json({ message: "Internal Server Error" });
    } 
};

export const verifyOtpForProduction = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const verifyResponse = await verifyOtp(email, otp);
        if (verifyResponse.error) {
          return res
            .status(401)
            .json({ error: true, message: verifyResponse.message });
        }
        return res.status(200).json({ error: false, message: verifyResponse.message });
    }
    catch (error) {
        console.error("Error in verifyOtpForProduction:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const addSyncEmails = async (req, res) => {
  try {
    const { emails } = req.body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ message: "Provide at least one email in array format." });
    }

    const records = emails.map((email) => ({
      email,
      is_active: true,
    }));

    const created = await SyncEmail.bulkCreate(records, { ignoreDuplicates: true });

    return res.status(201).json({
      message: `${created.length} emails added successfully.`,
      data: created,
    });
  } catch (error) {
    console.error("Error adding sync emails:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

export const getSyncEmails = async (req, res) => {
  try {
    const { activeOnly } = req.query;

    const where = activeOnly === "true" ? { is_active: true } : {};

    const emails = await SyncEmail.findAll({ where });

    return res.status(200).json({ count: emails.length, data: emails });
  } catch (error) {
    console.error("Error fetching sync emails:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

export const updateSyncEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, is_active } = req.body;

    const syncEmail = await SyncEmail.findByPk(id);
    if (!syncEmail) {
      return res.status(404).json({ message: "Email record not found" });
    }

    if (email !== undefined) syncEmail.email = email;
    if (is_active !== undefined) syncEmail.is_active = is_active;

    await syncEmail.save();

    return res.status(200).json({ message: "Email updated successfully", data: syncEmail });
  } catch (error) {
    console.error("Error updating sync email:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

export const deleteSyncEmail = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await SyncEmail.destroy({ where: { id } });

    if (!deleted) {
      return res.status(404).json({ message: "Email record not found" });
    }

    return res.status(200).json({ message: "Email deleted successfully" });
  } catch (error) {
    console.error("Error deleting sync email:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};



export const toggleStatusForInterns = async (req, res) => {
  const { id } = req.params;

  try {
    const account = await UserDepartment.findByPk(id);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const newStatus = account.status === 'active' ? 'disabled' : 'active';

    await account.update({ status: newStatus });

    return res.json({ success: true, status: newStatus });
  } catch (error) {
    console.error('Toggle enable error:', error);
    return res.status(500).json({ error: 'Failed to toggle enable' });
  }
};

export const deleteInternRoleAccount =async (req, res) => {
  const { id } = req.params;

  try {
    const account = await UserDepartment.findByPk(id);

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    await account.destroy();

    return res.json({ success: true, message: 'Account deleted' });
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({ error: 'Failed to delete account' });
  }
};

const SALT_ROUNDS = 10;
export const updateUserDepartmentRolePassword= async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  try {
    const account = await UserDepartment.findByPk(id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await account.update({ password: hashedPassword });

    return res.json({ success: true, message: 'Password updated' });
  } catch (error) {
    console.error('Password update error:', error);
    return res.status(500).json({ error: 'Failed to update password' });
  }
};