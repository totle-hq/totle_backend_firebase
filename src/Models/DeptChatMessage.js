import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";

const DeptChatMessage = sequelize1.define("DeptChatMessage", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  department: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  authorId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  authorName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  authorGlobalRole: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  authorDeptRole: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
}, {
  schema: "user", // ✅ you’re using schema "user"
  tableName: "DeptChatMessages",
  timestamps: true, // adds createdAt / updatedAt
});

export default DeptChatMessage;
