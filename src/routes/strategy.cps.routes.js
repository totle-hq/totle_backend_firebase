import express from "express";
import { getAggregate, getGeo } from "../controllers/strategyCps.controller.js";

const router = express.Router();

router.get("/aggregate", getAggregate);
router.get("/geo", getGeo);

export default router;
