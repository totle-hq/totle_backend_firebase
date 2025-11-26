// controllers/paymentController.js

import Razorpay from "razorpay";
import shortid from "shortid";

import dotenv from "dotenv";

dotenv.config();

// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,       // paste your Test Key ID here
//   key_secret: process.env.RAZORPAY_KEY_SECRET // paste your Test Key Secret here
// });


// Helper function to create Razorpay instance based on mode
export function getRazorpayInstance(paymentMode = "DEMO") {
  const isLive = paymentMode === "LIVE";
  return new Razorpay({
    key_id: isLive ? process.env.RAZORPAY_LIVE_KEY_ID : process.env.RAZORPAY_KEY_ID,
    key_secret: isLive ? process.env.RAZORPAY_LIVE_KEY_SECRET : process.env.RAZORPAY_KEY_SECRET,
  });
}


// Controller to create order
export const createOrder = async (req, res) => {
  try {
    const { amount, paymentMode = "DEMO" } = req.body; // Accept paymentMode from request

    const razorpay = getRazorpayInstance(paymentMode); // Get correct Razorpay instance

    const options = {
      amount: amount * 100, // Razorpay uses paise
      currency: "INR",
      receipt: shortid.generate(),
      payment_capture: 1,
    };

    const order = await razorpay.orders.create(options);

    res.status(200).json({
      success: true,
      orderId: order.id,
      currency: order.currency,
      amount: amount,
      paymentMode, // Return back for clarity
    });

  } catch (error) {
    console.error("Error in createOrder:", error);
    res.status(500).json({ success: false, message: "Failed to create order" });
  }
};
