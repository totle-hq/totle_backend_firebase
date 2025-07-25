import { 
  createUserDomainProgress,
  getAllUserDomainProgress,
  updateUserDomainProgress,
  deleteUserDomainProgress, 
  getDomain
} from "../controllers/progressTracker.controller.js";
import express from "express";
const router = express.Router();
router.get('/getProgress',getAllUserDomainProgress); //done
router.post('/createProgress', createUserDomainProgress); //done
router.put('/updateProgress', updateUserDomainProgress);//done
router.delete('/deleteProgress', deleteUserDomainProgress);//done
router.get("/domain/search",getDomain) //done


export default router;