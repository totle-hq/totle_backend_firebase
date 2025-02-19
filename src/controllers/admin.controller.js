
import { userDb } from "../config/prismaClient.js";
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();


export const createAdmin = async (email, password) => {
  return await userDb.admin.create({
    data: { email, password, status: "active" },
  });
};

export const findAdminByEmail = async (email) => {
  return await userDb.admin.findUnique({ where: { email } });
};

export const updateAdminStatus = async (adminId, status) => {
  return await userDb.admin.update({
    where: { id: adminId },
    data: { status },
  });
};



export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await findAdminByEmail(email);

    if (!admin) return res.status(400).json({ message: "Admin not found" });

    if (admin.status !== "active") {
      return res.status(403).json({ message: "Admin account is inactive. Contact Super Admin." });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: admin.id, name: admin.name, status: admin.status, email: admin.email }, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.status(200).json({message: "Successfully Logged in!", token, admin:{name: admin.name, email: admin.email} });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};


export const getAdminDetails = async (req, res) => {
  try {
    const token = req.header("Authorization");

    if (!token) {
      return res.status(401).json({ message: "No token, authorization denied" });
    }

    const decoded = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);
    if (!decoded) {
      return res.status(401).json({ message: "Invalid token" });
    }

    // Find admin by decoded token ID
    const admin = await userDb.admin.findUnique({ where: { id: decoded.id } });

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.json({
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        status: admin.status
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};



