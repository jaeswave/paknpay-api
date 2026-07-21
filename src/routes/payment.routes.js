const express = require("express");
const router = express.Router();
const { protect, protectAdmin } = require("../middleware/auth");
const {
  initializePayment,
  verifyPayment,
  simulatePayment,
  webhook,
  getCommissionLedger,
  getCommissionSummary,
  getMyCommissionSummary,
} = require("../controllers/payment.controller");

router.post("/initialize", initializePayment);
router.get("/verify", verifyPayment);
router.post("/simulate/:reference", simulatePayment);
router.post("/webhook", webhook);

router.get("/commissions/mine", protect, getMyCommissionSummary);
router.get("/commissions", protectAdmin, getCommissionLedger);
router.get("/commissions/summary", protectAdmin, getCommissionSummary);

module.exports = router;
