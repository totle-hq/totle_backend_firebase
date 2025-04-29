// topic.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../../config/sequelize.js';
import { Subject } from './SubjectModel.js';

const Topic = sequelize1.define('Topic', 
  {
  id: {
    type: DataTypes.UUID,
    // autoIncrement: true,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,  // Automatically generate a UUID for the primary key
  },
  qualified_teacher_ids : {
    type: DataTypes.ARRAY(DataTypes.UUID), // Only works in PostgreSQL
    allowNull: false,
    defaultValue: [],
  },
  qualified_teacher_names : {
    type: DataTypes.ARRAY(DataTypes.STRING), // Only works in PostgreSQL
    allowNull: false,
    defaultValue: [],
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,  // Name of the topic (e.g., "Algebra", "Mechanics")
  },
  description: {
    type: DataTypes.STRING,  // Optional description of the topic
  },
  parent_id: {  // ✅ Unified Parent ID
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Subject,
      key: 'id',
    },
  },
  parent_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM("active", "draft", "archived"),
    defaultValue: "draft",
  },
  is_domain: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  is_topic: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  session_count: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  average_session_count: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  prices: {
    type: DataTypes.JSONB,
    defaultValue: { bridger: 0, expert: 0, master: 0, legend: 0 },
  },
  topic_params: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  prerequisites: {
    type: DataTypes.ARRAY(DataTypes.JSONB),
    defaultValue: [],
  },
  subtopics: {
    type: DataTypes.JSONB,
    defaultValue: [],
    allowNull: false,
  },
  
  createdAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,  // Automatically set the current timestamp
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,  // Automatically set the current timestamp on updates
  },
  
  
}, {
  schema: 'catalog',
  tableName: 'topic',  // Table name for topics
  paranoid: true
});


export { Topic };
