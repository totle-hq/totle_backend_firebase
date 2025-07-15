import express from "express";
import { storeUserDeviceDetails } from '../../controllers/UserControllers/device.controller.js';
import authMiddleware from "../../middlewares/authMiddleware.js";

const router = express.Router();

// Route to store device info
router.post("/device-info", authMiddleware, storeUserDeviceDetails);

export default router;
