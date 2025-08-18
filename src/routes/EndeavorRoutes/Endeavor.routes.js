import express from "express";
import { getCatalogueChildrenUpToDomain } from "../../controllers/EndeavourController/Endeavour.controller.js";

const router = express.Router();

router.get("/", getCatalogueChildrenUpToDomain);

export default router;