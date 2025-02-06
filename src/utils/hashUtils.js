// const bcrypt = require("bcrypt");
import bcrypt from 'bcryptjs';

export const hashPassword = async (password) => {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

// module.exports = { hashPassword, comparePassword };
