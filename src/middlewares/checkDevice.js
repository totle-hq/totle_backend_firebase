import { UserDevice } from "../Models/UserModels/userDevice.model.js";
import jwt from "jsonwebtoken";

export const checkDevice = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Missing token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const { fingerprint } = req.body;
    if (!fingerprint) return res.status(400).json({ message: "Missing fingerprint" });

    const registeredDevice = await UserDevice.findOne({ where: { userId } });

    if (!registeredDevice || registeredDevice.fingerprint !== fingerprint) {
      return res.status(403).json({ message: "Unrecognized device" });
    }

    next(); // Device is valid, allow access
  } catch (err) {
    console.error("Device check failed:", err);
    return res.status(500).json({ message: "Internal error" });
  }
};
