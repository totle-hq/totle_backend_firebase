import { Admin } from "../../Models/UserModels/AdminModel.js";
import { Department } from "../../Models/UserModels/Department.js";
import { Role } from "../../Models/UserModels/Roles.Model.js";
import { UserDepartment } from "../../Models/UserModels/UserDepartment.js";
import { autoSeedRolesAndDepartments, seedDepartments, seedRoles } from "../../seeders/roleDeptSeeder.js";


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
    const { name,email, departmentId, password, roleId } = req.body;


    const superAdmin = await Admin.findByPk(id);
    console.info(superAdmin.global_role);
    if (!superAdmin || (superAdmin.global_role !== 'Superadmin' && superAdmin.global_role !== 'Founder')) {
        console.info("Acess denied", superAdmin.global_role)
      return res.status(403).json({ message: "Access denied: Invalid superadmin" });
    }

    if (!name || !departmentId) {
      return res.status(400).json({ message: "Role name and department ID are required" });
    }

    const department = await Department.findByPk(departmentId);
    if (!department) {
      return res.status(404).json({ message: "Department not found" });
    }

    // Check if the role already exists
    const existingRole = await UserDepartment.findOne({
      where: { departmentId, roleName: name, status: 'active' },
    });

    if (existingRole) {
      return res.status(409).json({ message: "Role already exists in this department" });
    }
    const role = await Role.findByPk(roleId);
    if (!role) {
      return res.status(404).json({ message: "Role not found." });
    }

    // Create the new role
    const newRole = await UserDepartment.create({
      departmentId,
      roleName: role.name, // Use roleName from Role model or fallback to name
      department_role_id: roleId,
      headId: id, // Assuming the creator is the head
      status: 'active', // Default status on creation
      name: name,
      email: email,
      password: password,
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
