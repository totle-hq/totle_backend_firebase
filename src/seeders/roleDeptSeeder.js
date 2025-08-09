// seeders/roleDeptSeeder.js
import { Department } from "../Models/UserModels/Department.js";
import { Role } from "../Models/UserModels/Roles.Model.js";

export const seedDepartments = async () => {
    const departments = ["Research","Tech","Ops","Support","Marketing","Strategy","Finance","Legal","HR"];
    await Department.bulkCreate(
        departments.map(name => ({ name })),
        { ignoreDuplicates: true }
    );
};

export const seedRoles = async () => {
    const rolesList = ["Senior Project Manager","Project Manager","Contributor","Watcher","Department Head","Intern"];
    await Role.bulkCreate(
        rolesList.map(name => ({ name })),
        { ignoreDuplicates: true }
    );
};

export const autoSeedRolesAndDepartments = async () => {
    await seedDepartments();
    await seedRoles();
};
