// import { userDb } from "../config/prismaClient.js";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import {Admin} from "../../Models/UserModels/AdminModel.js";
import { sequelize1 } from "../../config/sequelize.js";
dotenv.config();

const coreDepartments = [
  { name: "Research", code: "tenjiku" },
  { name: "Tech", code: "manhattan" },
  { name: "Operations", code: "helix" },
  { name: "Customer Support", code: "sentinel" },
  { name: "Marketing", code: "echo" },
  { name: "Strategy", code: "kyoto" },
  { name: "Finance", code: "vault" },
  { name: "Legal", code: "legion" },
  { name: "Human Resources", code: "haven" },
];

export const ensureFounder = async () => {
  try {
    const email = "founder@totle.co";
    const password = "BareCapital&210"; // Change this to a strong password
    const name = "Sriragh";
    const hashedPassword = await bcrypt.hash(password, 10);

    await sequelize1.authenticate() // ✅ Ensure database connection

    let founder = await Admin.findOne({ where: { email } });
    if (!founder) {
      founder = await Admin.create({
        name,
        email,
        password: hashedPassword,
        status: "active",
        global_role: "Founder"
      });
      console.log("🎉 Founder created");
    } else {
      console.log("✅ Founder already exists");
    }

    for (const dept of coreDepartments) {
      const [department, created] = await Department.findOrCreate({
        where: { code: dept.code },
        defaults: {
          name: dept.name,
          headId: founder.id,
        }
      });

      if (!created && department.headId !== founder.id) {
        department.headId = founder.id;
        await department.save();
      }

      // Step 3: Assign founder to each department in user_departments
      await UserDepartment.findOrCreate({
        where: {
          userId: founder.id,
          departmentId: department.id,
        },
        defaults: {
          roleType: "manage",
          tags: [], // Add default tags if needed
        }
      });
    }

    console.log("🎉 Founder added successfully!");
  } catch (error) {
    console.error("❌ Error creating Founder:", error);
  } 
};