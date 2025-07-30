// models/TeachResource.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";

export const TeachResource = sequelize1.define("TeachResource", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  teacher_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  topic_id: {
  type: DataTypes.UUID,
  allowNull: false,
  comment: "Link to a specific topic",
},
public_id:{
type:DataTypes.STRING,
allowNull:true,
},
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM("pdf", "image", "video"),
    allowNull: false,
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  uploaded_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: "teach_resources"
});
