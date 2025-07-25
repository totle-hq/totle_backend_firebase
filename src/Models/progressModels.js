<<<<<<< HEAD
// UserSubjectProgressModel.js
=======
>>>>>>> Champion/Mohnish/tracker
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js';

const UserDomainProgress = sequelize1.define('UserDomainProgress', {
<<<<<<< HEAD
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },

  user_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  subject_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  subject_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  topic_ids: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
    defaultValue: [],
  },

  topic_names: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
    defaultValue: [],
  },

  topics_completed: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
    defaultValue: [],
  },

  hierarchy_path: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    allowNull: false,
    defaultValue: [],
  },

  motivation: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  goal: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  createdAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
  },

  updatedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
  },
}, {
  schema: 'user',
  tableName: 'user_progress',
});


export default UserDomainProgress ;
=======
  user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    domain_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    domain_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    subjects: {
      type: DataTypes.JSONB, // ✅ nested subject-topic structure
      allowNull: false,
      defaultValue: [],
    },
    hierarchy_path: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    motivation: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    goal: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    topics_completed: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: false,
      defaultValue: [],
    },
    completed_by_self: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: false,
      defaultValue: [],
    },
    completed_by_totle: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      allowNull: false,
      defaultValue: [],
    },
  },
  {
    tableName: "user_domain_progress",
    schema: "progress",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["user_id", "domain_id"],
      },
    ],
  }
);

export default UserDomainProgress;
>>>>>>> Champion/Mohnish/tracker
