import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";

export const KnowledgeQueue = sequelize1.define(
  "KnowledgeQueue",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    schema: "catalog",
    tableName: "knowledge_queue",
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ["position"] }],
  }
);
