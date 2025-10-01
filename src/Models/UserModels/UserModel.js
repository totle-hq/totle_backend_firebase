// Models/UserModels/UserModel.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js"; // Use the main DB connection
import { CpsProfile } from "../CpsProfile.model.js";

const User = sequelize1.define(
  "User",
  {
    id: {
      type: DataTypes.UUID, // ✅ Use UUID as primary key
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    googleId: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    password: {
      type: DataTypes.STRING,
    },
    mobile: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    dob: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    gender: {
      type: DataTypes.ENUM("male", "female", "other"),
      allowNull: true,
    },
    known_language_ids: {
      type: DataTypes.ARRAY(DataTypes.INTEGER), // ✅ Stores multiple language IDs
      allowNull: true,
    },
    preferred_language_id: {
      type: DataTypes.INTEGER,
      references: {
        model: { schema: "user", tableName: "languages" },
        key: "language_id",
      },
      allowNull: true,
    },
    educational_qualifications: {
      type: DataTypes.ARRAY(DataTypes.STRING), // ✅ Stores multiple qualifications
      allowNull: true,
    },
    currentOccupation: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    skills: {
      type: DataTypes.ARRAY(DataTypes.STRING), // ✅ Stores multiple skills
      allowNull: true,
    },
    years_of_experience: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    latitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    longitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'ip_address', // ✅ maps to snake_case column in DB
      comment: "User's IP address"
    },
    profilePictureUrl: {
      type: DataTypes.TEXT, // ✅ Store image as BLOB
      allowNull: true,
    },
    profile_picture_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isLoggedIn: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    profileTimezone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    deviceType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    browser: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    os: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    role: {
      type: DataTypes.ENUM("learner", "teacher", "admin"),
      allowNull: false,
      defaultValue: "learner",
    },

  },
  {
    schema: "user", // Private schema
    tableName: "users", // Table name
    timestamps: true,
  }
);

// Ensure a CPS row exists for every NEW user (raw SQL, no model dependency)
User.afterCreate(async (user, options) => {
  const { transaction } = options || {};
  try {
    await CpsProfile.findOrCreate({
      where: { user_id: user.id },
      defaults: { user_id: user.id },
      transaction,
    });
    console.log("[CPS] ensured cps_profile for", user.id);
  } catch (err) {
    console.error("[CPS] failed to ensure cps_profile for", user.id, err);
  }
});

User.afterBulkCreate(async (users, options) => {
  const { transaction } = options || {};
  try {
    await Promise.all(
      users.map(u =>
        CpsProfile.findOrCreate({
          where: { user_id: u.id },
          defaults: { user_id: u.id },
          transaction,
        })
      )
    );
    console.log("[CPS] ensured cps_profile for", users.length, "users");
  } catch (err) {
    console.error("[CPS] bulk cps_profile ensure failed", err);
  }
});



export { User };
