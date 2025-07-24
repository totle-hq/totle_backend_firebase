import { 
  createUserDomainProgress,
  getAllUserDomainProgress,
  updateUserDomainProgress,
  deleteUserDomainProgress, 
  getDomain
} from "../controllers/progressTracker.controller.js";
import express from "express";
const router = express.Router();
router.get('/domain/progress',getAllUserDomainProgress);
router.post('/domain/progress', createUserDomainProgress);
router.put('/domain-table', updateUserDomainProgress);
router.delete('/', deleteUserDomainProgress);
router.get("/domain/search",getDomain)

export default router;