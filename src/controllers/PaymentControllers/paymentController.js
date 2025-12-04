// controllers/PaymentControllers/paymentController.js

import Razorpay from "razorpay";
import shortid from "shortid";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { BankDetails } from "../../Models/UserModels/BankDetailsModel.js";

dotenv.config();

function requireUser(req, res) {
  const uid =
    req.user?.id ||
    req.user?.userId ||
    req.user?.userid ||
    req.user?.user_id;

  if (!uid) {
    res.status(401).json({ message: "Unauthenticated" });
    return null;
  }

  return uid;
}


// ---------------- RAZORPAY INSTANCE ----------------
export function getRazorpayInstance(mode = "DEMO") {
  const isLive = mode === "LIVE";
  return new Razorpay({
    key_id: isLive ? process.env.RAZORPAY_LIVE_KEY_ID : process.env.RAZORPAY_KEY_ID,
    key_secret: isLive
      ? process.env.RAZORPAY_LIVE_KEY_SECRET
      : process.env.RAZORPAY_KEY_SECRET,
  });
}

// ---------------- CREATE ORDER ----------------
export const createOrder = async (req, res) => {
  try {
    const { amount, paymentMode = "DEMO" } = req.body;

    const rp = getRazorpayInstance(paymentMode);

    const order = await rp.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: shortid.generate(),
      payment_capture: 1,
    });

    res.json({
      success: true,
      orderId: order.id,
      currency: order.currency,
      amount,
      paymentMode,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to create order" });
  }
};

// ---------------- GET BANK DETAILS ----------------
export const getBankDetails = async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  try {
    const bank = await BankDetails.findOne({ where: { user_id: userId } });

if (!bank) {
  return res.json({
    accountNumber: null,
    ifsc: null,
    holderName: null,
    bankName: null,
    accountType: null,
  });
}


    res.json({
      accountNumber: bank.account_number,
      ifsc: bank.ifsc_code,
      holderName: bank.account_holder,
      bankName: bank.bank_name,
      accountType: bank.account_type,
    });
    console.log("BANK DETAILS → req.user =", req.user);

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ---------------- ADD / UPDATE BANK DETAILS ----------------
export const addOrUpdateBankDetails = async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  try {
    const {
      account_number,
      ifsc_code,
      account_holder,
      bank_name,
      account_type = "savings",
    } = req.body;

    const existing = await BankDetails.findOne({ where: { user_id: userId } });

    if (existing) {
      await existing.update({
        account_number,
        ifsc_code,
        account_holder,
        bank_name,
        account_type,
      });

      return res.json({ message: "BANK_UPDATED" });
    }

    await BankDetails.create({
      id: uuidv4(),
      user_id: userId,
      account_number,
      ifsc_code,
      account_holder,
      bank_name,
      account_type,
    });

    res.status(201).json({ message: "BANK_ADDED" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ---------------- TRANSACTION HISTORY ----------------
export const getTransactionHistory = async (req, res) => {
  res.json([]); // backend team will plug real data later
};

// ---------------- EARNINGS TREND ----------------
export const getEarningsTrend = async (req, res) => {
  res.json([]); // backend team fills in real trend
};

// ---------------- BALANCE SUMMARY ----------------
export const getBalanceStats = async (req, res) => {
  res.json({
    totalEarned: 0,
    pendingClearance: 0,
    availableBalance: 0,
  });
};

// ---------------- DOWNLOAD STATEMENT ----------------
export const downloadStatement = async (req, res) => {
  res.json({
    url: null, // backend will generate PDF/CSV in phase 2
  });
};
