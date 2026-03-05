import express from "express";
import { confirmBooking, createPaidBookingOrder, getTeachersForTopic, handlePaymentFailure } from "../../controllers/PiadTeacher.controller.js";

import authMiddleware from "../../middlewares/authMiddleware.js";
const router = express.Router();

router.get('/teacher',authMiddleware,getTeachersForTopic); // for fetching the user which are having the paid session with each level in a particular topic,
// get slot from frontend and payment
// router.post('/booking/create', authMiddleware, BookPaidSlot);
router.post('/booking/confirm', authMiddleware, confirmBooking);
router.post('/booking/failure', authMiddleware, handlePaymentFailure);
router.post("/booking/order", authMiddleware, createPaidBookingOrder);

export default router;
