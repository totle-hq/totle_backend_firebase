import { Department } from "../../Models/UserModels/Department";

export const AddDepartments = async (req, res) => {
    try{
        const departments = ["Research","Tech","Ops","Support","Marketing","Strategy", "Finance","Legal","HR"];
        await Department.bulkCreate(
            departments.map(name => ({ name })),
            { ignoreDuplicates: true}
        );
        res.status(201).json({ message: "Departments added successfully" });
    }
    catch (error) {
        console.error("Error in AddDepartments:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const getAllDepartments = async (req, res) => {
    try {
        const departments = await Department.findAll({
            where: { parentId: null},
            order: [['createdAt']],
            attributes: ['id', 'name', 'createdAt', 'updatedAt']
        });
        res.status(200).json(departments);
    }
    catch (error) {
        console.error("Error in getAllDepartments:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const AddRoles = async (req, res) => {
    try {
        const Roles = ["Senior Project Manager","Project Manager", "Contributor","Watcher", "Department Head","Intern"];
        await Roles.bulkCreate(
            Roles.map(name => ({ name })),
            { ignoreDuplicates: true }
        );
        res.status(201).json({ message: "Roles added successfully" });
    } catch (error) {
        console.error("Error in AddRoles:", error);
        res.status(500).json({ message: "Internal Server Error" }); 
    }
};

export const getAllRoles = async (req, res) => {
    try {
        const roles = await Role.findAll({
            order: [['createdAt']],
            attributes: ['id', 'name', 'createdAt', 'updatedAt']
        });
        res.status(200).json(roles);
    } catch (error) {
        console.error("Error in getAllRoles:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const autoRolesAndDepartments = async (req, res) => {
    try {
        await AddDepartments(req, res);
        await AddRoles(req, res);
        res.status(200).json({ message: "Departments and Roles added successfully" });
    } catch (error) {
        console.error("Error in autoRolesAndDepartments:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};