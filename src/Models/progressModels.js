import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js';

const UserDomainProgress = sequelize1.define('UserDomainProgress', {
  user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    domain_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    domain_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    subjects: {
      type: DataTypes.JSONB, // ✅ nested subject-topic structure
      allowNull: false,
      defaultValue: [],
    },
    hierarchy_path: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    motivation: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    goal: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    topics_completed: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: false,
      defaultValue: [],
    },
    completed_by_self: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: false,
      defaultValue: [],
    },
    completed_by_totle: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: false,
      defaultValue: [],
    },
  },
  {
    tableName: "user_domain_progress",
    schema: "user",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["user_id", "domain_id"],
      },
    ],
  }
);

export default UserDomainProgress;
