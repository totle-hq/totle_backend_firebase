import { createUserDomainProgress,
  getAllUserDomainProgress,
  updateUserDomainProgress,
  deleteUserDomainProgress, } from "../controllers/progressTracker.controller.js";
import express from "express";
const router = express.Router();
router.get('/id/:id',getAllUserDomainProgress);
router.post('/', createUserDomainProgress);
router.put('/:id', updateUserDomainProgress);
router.delete('/:id', deleteUserDomainProgress);


export default router;