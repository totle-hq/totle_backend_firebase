// src/controllers/UserControllers/device.controller.js

import { UserDevice } from "../../Models/UserModels/userDevice.model.js";
import jwt from "jsonwebtoken";

export const storeUserDeviceDetails = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: true, message: "Missing token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    if (!userId) return res.status(401).json({ error: true, message: "Invalid token" });

    const {
      fingerprint,
      city,
      lat,
      lng
    } = req.body;

    const ip = req.ip;
    const userAgent = req.headers["user-agent"];

    // 🔍 Check if device already exists for the user
    const existingDevice = await UserDevice.findOne({ where: { userId } });

    if (existingDevice) {
      // 🔄 Update existing device info
      await UserDevice.update(
        {
          fingerprint,
          ipAddress: ip,
          userAgent,
          city,
          lat,
          lng
        },
        { where: { userId } }
      );
      return res.status(200).json({
        success: true,
        message: "Device info updated successfully",
      });
    } else {
      // 🆕 Create new device entry
      const newDevice = await UserDevice.create({
        userId,
        fingerprint,
        ipAddress: ip,
        userAgent,
        city,
        lat,
        lng
      });

      return res.status(201).json({
        success: true,
        message: "Device info stored successfully",
        device: newDevice,
      });
    }

  } catch (error) {
    console.error("Error storing device info:", error);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
};
