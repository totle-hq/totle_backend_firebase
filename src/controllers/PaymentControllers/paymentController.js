// controllers/paymentController.js

import Razorpay from "razorpay";
import shortid from "shortid";

import dotenv from "dotenv";
import { v4 as uuidv4 } from 'uuid';
import { BankDetails } from "../../Models/UserModels/BankDetailsModel.js";

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



// 🔹 GET bank details for a user
export const getBankDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    const bank = await BankDetails.findOne({ where: { user_id: userId } });
    if (!bank) return res.status(404).json({ message: "No bank details found" });

    res.json({
      accountNumber: `**** **** ${bank.account_number.slice(-4)}`,
      ifsc: bank.ifsc_code,
      holderName: bank.account_holder,
      bankName: bank.bank_name,
      isVerified: bank.is_verified
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// 🔹 POST/PUT Add or Update bank details
export const addOrUpdateBankDetails = async (req, res) => {
  try {
    const {
      userId,
      accountNumber,
      ifsc,
      holderName,
      bankName,
      accountType,
      isVerified
    } = req.body;

    const existing = await BankDetails.findOne({ where: { user_id: userId } });

    if (existing) {
      await existing.update({
        account_number: accountNumber,
        ifsc_code: ifsc,
        account_holder: holderName,
        bank_name: bankName,
        account_type: accountType || 'savings',
        is_verified: isVerified,
        verified_at: isVerified ? new Date() : null
      });

      return res.json({ message: "Bank details updated" });
    }

    await BankDetails.create({
      id: uuidv4(),
      user_id: userId,
      account_number: accountNumber,
      ifsc_code: ifsc,
      account_holder: holderName,
      bank_name: bankName,
      account_type: accountType || 'savings',
      is_verified: isVerified,
      verified_at: isVerified ? new Date() : null
    });

    res.status(201).json({ message: "Bank details added" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// 🔹 GET Transaction History (mocked)
export const getTransactionHistory = async (req, res) => {
  const mockTxns = [
    { id: 'TXN_10234', date: '2023-10-15', amount: 15400, status: 'Paid', reference: 'HDFC000123' },
    { id: 'TXN_10235', date: '2023-11-01', amount: 22100, status: 'Paid', reference: 'HDFC000456' },
    { id: 'TXN_10236', date: '2023-11-15', amount: 18500, status: 'Processing', reference: '-' },
  ];

  res.json(mockTxns);
};

// 🔹 GET Earnings Graph (mocked)
export const getEarningsTrend = async (req, res) => {
  const mockGraph = [
    { month: 'Jul', amount: 12000 },
    { month: 'Aug', amount: 18500 },
    { month: 'Sep', amount: 15400 },
    { month: 'Oct', amount: 22100 },
    { month: 'Nov', amount: 28000 },
    { month: 'Dec', amount: 35000 }
  ];

  res.json(mockGraph);
};

// 🔹 GET Balances
export const getBalanceStats = async (req, res) => {
  const mockStats = {
    totalEarned: 76000,
    pendingClearance: 18500,
    availableBalance: 4200
  };

  res.json(mockStats);
};

// 🔹 GET Download Statement (stubbed)
export const downloadStatement = async (req, res) => {
  // In real life: generate PDF/CSV & stream/download
  res.json({ url: "https://example.com/statement.pdf" });
};
