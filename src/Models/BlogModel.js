// models/blog.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js'; // Use the main DB connection

const Blog = sequelize1.define('Blog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  title: {
    type: DataTypes.STRING,
  },
  slug: {
    type: DataTypes.STRING,
  },
  description: {
    type: DataTypes.STRING,
  },
  content: {
    type: DataTypes.STRING,
  },
  image: {
    type: DataTypes.STRING,
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  adminId: {
    type: DataTypes.UUID,
    references: {
      model: 'admins',
      key: 'id',
    },
  },
}, {
  schema: 'admin', // Private schema
  tableName: 'blogs', // Table name
});

export  {Blog};
