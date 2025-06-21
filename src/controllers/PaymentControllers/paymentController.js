// controllers/paymentController.js

import Razorpay from "razorpay";
import shortid from "shortid";

import dotenv from "dotenv";

dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,       // paste your Test Key ID here
  key_secret: process.env.RAZORPAY_KEY_SECRET // paste your Test Key Secret here
});

// Controller to create order
export const createOrder = async (req, res) => {
  try {
    const { amount } = req.body; // Amount in rupees (e.g., 500)

    const options = {
      amount: amount * 100,   // Razorpay expects amount in paise (multiply by 100)
      currency: "INR",
      receipt: shortid.generate(),
      payment_capture: 1,     // Auto capture after payment
    };

    const order = await razorpay.orders.create(options);

    res.status(200).json({
      success: true,
      orderId: order.id,
      currency: order.currency,
      amount: amount,
    });

  } catch (error) {
    console.error("Error in createOrder:", error);
    res.status(500).json({ success: false, message: "Failed to create order" });
  }
};
