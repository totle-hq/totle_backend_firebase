// models/admin.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js'; // Use the main DB connection

const Admin = sequelize1.define('Admin', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  name: {
    type: DataTypes.STRING,
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'active',
  },
   global_role: {
    type: DataTypes.ENUM('Founder', 'Superadmin', 'None'),
    defaultValue: 'None',
  },
  departments: {
    type: DataTypes.ARRAY(DataTypes.STRING), // e.g., ['Helix', 'Tenjiku']
    defaultValue: [],
  },
  roles: {
    type: DataTypes.JSONB, // e.g., { Helix: 'Project Manager', Tenjiku: 'Contributor' }
    defaultValue: {},
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING), // e.g., ['Test Gatekeeper', 'Moderator']
    defaultValue: [],
  },
  is_intern: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  intern_type: {
    type: DataTypes.STRING, // e.g., Engineering Intern, Research Intern
    allowNull: true,
  },
  intern_expiry: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  schema: 'admin', // Private schema
  tableName: 'admins', // Table name
});

export  {Admin};
