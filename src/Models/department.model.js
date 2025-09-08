// src/Models/department.model.js
import { DataTypes } from 'sequelize';
import { sequelize1 } from '../config/sequelize.js';

export const Department = sequelize1.define(
  'Department',
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4, // db also has uuid_generate_v4() default; this is fine
      comment: 'Department UUID',
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      comment: 'e.g., Tenjiku, Manhattan, Helix',
      validate: { len: [1, 100] },
    },
    // IMPORTANT:
    // Make slug TEMPORARILY nullable and remove inline unique so sync({ alter: true })
    // can add the column without failing on existing rows that have NULL slug.
    // Uniqueness is enforced via the index below.
    slug: {
      type: DataTypes.STRING(120),
      allowNull: true,          // <— changed from false
      // unique: true,          // <— removed; use unique index instead
      comment: 'URL-safe unique key: e.g., tenjiku, manhattan, helix',
      validate: {
        len: [1, 120],
        is: /^[a-z0-9]+(?:-[a-z0-9]+)*$/i, // kebab-case safe
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    schema: 'admin',
    tableName: 'departments',
    timestamps: true,
    paranoid: true,
    indexes: [
      { unique: true, fields: ['name'] },
      { unique: true, fields: ['slug'] }, // enforce uniqueness via index (safe with alter)
    ],
  }
);

// Auto-fill slug from name if missing (so new/updated rows don’t end up NULL)
Department.beforeValidate((dept) => {
  if (!dept.slug && dept.name) {
    const s = String(dept.name)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    dept.slug = s || null;
  }
});
