// topic.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js';
import { Subject } from './subject.js';  // Import the Subject model

const Topic = sequelize1.define('Topic', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,  // Name of the topic (e.g., "Algebra", "Mechanics")
  },
  description: {
    type: DataTypes.STRING,  // Optional description of the topic
  },
  subjectId: {
    type: DataTypes.INTEGER,
    references: {
      model: Subject,  // Reference to the Subject model
      key: 'id',
    },
    allowNull: false,  // The Topic must be linked to a Subject
  },
}, {
  schema: 'catalog',
  tableName: 'topic',  // Table name for topics
});


export { Topic };
