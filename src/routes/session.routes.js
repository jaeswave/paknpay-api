const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  initSession,
  findSession,
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
} = require("../controllers/session.controller");

router.post("/init", initSession);
router.get("/find", findSession);
router.get("/token/:token", getSessionByToken);
router.post("/token/:token/pay", requestPayment);

router.post("/manual", protect, createManualSession);
router.patch("/:sessionId/allow", protect, allowEntry);
router.patch("/:sessionId/confirm-exit", protect, confirmExit);
router.patch("/:sessionId/cash-paid", protect, markCashPaid);
router.patch("/:sessionId/waive", protect, waiveFee);
router.get("/lot/:lotId/active", protect, getActiveSessions);
router.get("/lot/:lotId/history", protect, getSessionHistory);
router.post("/sync", protect, syncOfflineSessions);

module.exports = router;
