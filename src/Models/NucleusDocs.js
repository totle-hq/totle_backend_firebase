// src/Models/NucleusDocs.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";   // ✅ correct import

const NucleusDocs = sequelize1.define(   // ✅ use sequelize1
  "NucleusDocs",
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    fileName: DataTypes.STRING,
    fileSize: DataTypes.BIGINT,
    contentType: DataTypes.STRING,
    s3Key: DataTypes.STRING,
    uploadedBy: DataTypes.STRING,
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
    },
    uploadedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    deletedAt: DataTypes.DATE,
  },
  {
    schema: "user",
    tableName: "NucleusDocs",
    paranoid: true,
  }
);

export default NucleusDocs;
