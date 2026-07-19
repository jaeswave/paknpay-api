const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  initSession,
  getSessionByToken,
  requestPayment,
  allowEntry,
  confirmExit,
  markCashPaid,
  waiveFee,
  createManualSession,
  getActiveSessions,
  syncOfflineSessions,
  getSessionHistory,
} = require('../controllers/session.controller');

// Public (driver routes — no auth needed)
router.post('/init', initSession);
router.get('/token/:token', getSessionByToken);
router.post('/token/:token/pay', requestPayment);

// Attendant routes (protected)
router.post('/manual', protect, createManualSession);
router.patch('/:sessionId/allow', protect, allowEntry);
router.patch('/:sessionId/confirm-exit', protect, confirmExit);
router.patch('/:sessionId/cash-paid', protect, markCashPaid);
router.patch('/:sessionId/waive', protect, waiveFee);
router.get('/lot/:lotId/active', protect, getActiveSessions);
router.get('/lot/:lotId/history', protect, getSessionHistory);
router.post('/sync', protect, syncOfflineSessions);

module.exports = router;
