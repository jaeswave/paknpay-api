const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/auth');
const {
  initializePayment,
  verifyPayment,
  simulatePayment,
  webhook,
  getCommissionLedger,
  getCommissionSummary,
} = require('../controllers/payment.controller');

router.post('/initialize', initializePayment);
router.get('/verify', verifyPayment);
router.post('/simulate/:reference', simulatePayment); // test-mode only — real Paystack payments never call this
router.post('/webhook', webhook);

// Commission tracking — platform-wide, across all lots, so this is gated
// behind admin auth (not lot-owner auth) since it exposes revenue data no
// individual lot owner should see for lots that aren't theirs.
router.get('/commissions', protectAdmin, getCommissionLedger);
router.get('/commissions/summary', protectAdmin, getCommissionSummary);

module.exports = router;
