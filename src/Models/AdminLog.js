import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";
import { Admin } from "./AdminModel.js";

const AdminLog = sequelize1.define(
  "AdminLog",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    admin_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: { schema: "admin", tableName: "admins" },
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    admin_name:{
      type: DataTypes.STRING,
      allowNull: false,
    },
    table_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    row_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    action: {
      type: DataTypes.ENUM("CREATE", "UPDATE", "DELETE"),
      allowNull: false,
    },
    previous_data: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    new_data: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    schema: "admin",
    tableName: "admin_logs",
    updatedAt: false, // We only need createdAt for logging
  }
);

AdminLog.belongsTo(Admin, {
  foreignKey: "admin_id", // ✅ correct FK
  targetKey: "id",        // Link to Admin.id
  as: "admin",
});


export { AdminLog };
