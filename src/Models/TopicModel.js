// topic.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js';
import { Subject } from './SubjectModel.js';

const Topic = sequelize1.define('Topic', 
  {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  parent_id: {  // ✅ Unified Parent ID
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Subject,
      key: 'id',
    },
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,  // Name of the topic (e.g., "Algebra", "Mechanics")
  },
  description: {
    type: DataTypes.STRING,  // Optional description of the topic
  },
}, {
  schema: 'catalog',
  tableName: 'topic',  // Table name for topics
  paranoid: true
});


export { Topic };
