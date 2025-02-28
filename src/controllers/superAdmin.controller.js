// import { userDb } from "../config/prismaClient.js";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import {Admin} from "../Models/AdminModel.js";
import { sequelize1 } from "../config/sequelize.js";
dotenv.config();

export const createSuperAdmin = async () => {
  try {
    const email = "admin@totle.com";
    const password = "Admin@123"; // Change this to a strong password
    const name = "Admin mawa";
    const hashedPassword = await bcrypt.hash(password, 10);

    await sequelize1.authenticate() // ✅ Ensure database connection

    const existingAdmin = await Admin.findOne({ where: { email } });
    if (existingAdmin) {
      console.log("✅ Super Admin already exists!");
      return;
    }

    await Admin.create({name, email, password: hashedPassword, status: "active" });

    console.log("🎉 Super Admin created successfully!");
  } catch (error) {
    console.error("❌ Error creating Super Admin:", error);
  } 
};


