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
        const { departmentId, roleId, name, email, password } = req.body;
        if(!departmentId) return res.status(400).json({ message: "Please select the department." });

        if(!roleId) return res.status(400).json({ message: "Please select the role." });
        
        if(!name) return res.status(400).json({ message: "Please enter the name." });
        
        if(!email) return res.status(400).json({ message: "Please enter the email." });
        
        if(!password) return res.status(400).json({ message: "Please enter the password." });
        
        let roletext = await Role.findOne({ where: { id: roleId } });
        if (!roletext) return res.status(400).json({ message: "Invalid role selected." });
        
        const newProfile = await UserDepartment.create({
            departmentId,
            roleName: roletext.name,
            department_role_id: roleId,
            name,
            email,
            password,
        });

        res.status(201).json({ message: "Profile created successfully", profile: newProfile });
    }
    catch (error) {
        console.error("Error in generateProfile:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const getAllUsersForRoles = async (req, res) => {
    try {
        const { departmentId } = req.query;
        let profiles = await UserDepartment.findAll({
            where: { departmentId },
            order: [['createdAt', 'DESC']],
            attributes: ['id', 'name', 'email', 'roleName', 'status'],
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
