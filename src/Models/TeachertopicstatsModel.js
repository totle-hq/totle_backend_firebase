import { sequelize1 } from "../config/sequelize.js";
import { DataTypes } from "sequelize";
export const Teachertopicstats=sequelize1.define('teacher_topic_stats',{
      id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
    teacherId: {
  type: DataTypes.UUID,
  allowNull: false,
},
node_id: {
  type: DataTypes.UUID,
  allowNull: false,
},
tier: {
  type: DataTypes.ENUM('Bridger', 'Expert', 'Master', 'Legend'),
  allowNull: false,
},
sessionCount: {
  type: DataTypes.INTEGER,
  defaultValue: 0,
},
rating: {
  type: DataTypes.FLOAT,
  defaultValue: 0,
}

},{
  schema:"catalog",
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  underscored: true,
 tableName: 'teacher_topic_stats',
})