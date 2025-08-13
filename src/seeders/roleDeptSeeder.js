// seeders/roleDeptSeeder.js
import { Department } from "../Models/UserModels/Department.js";
import { Role } from "../Models/UserModels/Roles.Model.js";

const DEPARTMENTS = [
  { name: 'Research', code: 'RSCH', codename: 'Tenjiku' },
  { name: 'Technology', code: 'TECH', codename: 'Manhattan' },
  { name: 'Operations', code: 'OPS', codename: 'Helix' },
  { name: 'Customer Success', code: 'CS', codename: 'Sentinel' },
  { name: 'Marketing', code: 'MKT', codename: 'Echo' },
  { name: 'Strategy', code: 'STRAT', codename: 'Kyoto' },
  { name: 'Finance', code: 'FIN', codename: 'Vault' },
  { name: 'Legal', code: 'LEG', codename: 'Legion' },
  { name: 'Human Resources', code: 'HR', codename: 'Haven' },
];

const ROLE_NAMES = [
  'Department head',
  'Senior PM',
  'PM',
  'Contributor',
  'Intern',
  'Watcher',
];

export const seedDepartments = async () => {
  await Department.bulkCreate(DEPARTMENTS, {
    ignoreDuplicates: true,
  });
};

export const seedRoles = async () => {
  const rolesList = ROLE_NAMES.map(name => ({ name }));
  await Role.bulkCreate(rolesList, {
    ignoreDuplicates: true,
  });
};

export const autoSeedRolesAndDepartments = async () => {
  await seedDepartments();
  await seedRoles();
};
