// src/Models/UserModels/UserModel.js
import { DataTypes } from "sequelize";
import { sequelize1 } from "../../config/sequelize.js";
import { CpsProfile } from "../CpsProfile.model.js";

const User = sequelize1.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
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
      type: DataTypes.ARRAY(DataTypes.INTEGER),
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
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
    },
    currentOccupation: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    skills: {
      type: DataTypes.ARRAY(DataTypes.STRING),
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
      field: "ip_address",
      comment: "User's IP address",
    },
    profilePictureUrl: {
      type: DataTypes.TEXT,
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
    isMinor: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "True if user is below 13 years of age at signup",
    },
    minorConsentAccepted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "True if parent/guardian consent was accepted for a minor",
    },
  },
  {
    schema: "user",
    tableName: "users",
    timestamps: true,
  }
);

// ✅ Define associations
User.hasMany(CpsProfile, {
  foreignKey: "user_id",
  as: "cpsProfile",
});

CpsProfile.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

// ✅ Hook: Automatically create baseline CPS IQ profile for new users
User.afterCreate(async (user, options) => {
  try {
    await sequelize1.query(
      `
      INSERT INTO "cps"."cps_profiles" (user_id, context_type, context_ref_id)
      VALUES ($1, 'IQ', NULL)
      ON CONFLICT (user_id, context_type, context_ref_id) DO NOTHING;
      `,
      { bind: [user.id], transaction: options?.transaction }
    );
    console.log(`[UserHook] CPS IQ profile seeded for ${user.id}`);
  } catch (err) {
    console.error(`[UserHook] Failed to seed CPS for ${user.id}:`, err.message);
  }
});

export { User };
