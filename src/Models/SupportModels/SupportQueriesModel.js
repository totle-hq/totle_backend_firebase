import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";

export const SupportQueriesModel = sequelize1.define(
  "SupportQueriesModel",
  {
    id:{
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    user_id:{
        type: DataTypes.UUID,
        allowNull: true,
    },
    query_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    query_type: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    short_text: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    status: {
        type: DataTypes.ENUM("pending","inProgress", "resolved"),
        defaultValue: "resolved",
    },
    priority: {
        type: DataTypes.ENUM("low", "medium", "high"),
        defaultValue: "low",
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    },
    {
    schema: "admin",
    tableName: "support_queries",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: false,
        fields: ["user_id", "status"],
      },
      {
        unique: false,
        fields: ["query_type"],
      },
    ],


  }
)