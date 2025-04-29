import { DataTypes } from "sequelize";
import { sequelize1 } from "../config/sequelize.js";

export const Review = sequelize1.define("Review", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  teacher_id: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: "Teacher being reviewed",
  },
  student_id: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: "User giving the review",
  },
  session_id: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: "Session being reviewed (optional)",
  },
  rating: {
    type: DataTypes.FLOAT,
    allowNull: false,
    validate: {
      min: 1,
      max: 5,
    },
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});
