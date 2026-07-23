const express = require("express");
const router = express.Router();
const { protect, protectAdmin } = require("../middleware/auth");
const {
  createLot,
  getLotByShortCode,
  getLotById,
  updateLot,
  getLotStats,
  getLotsForAdmin,
  reviewLotApproval,
} = require("../controllers/lot.controller");

router.get("/code/:code", getLotByShortCode);
router.get("/:id", protect, getLotById);
router.post("/", protect, createLot);
router.patch("/:id", protect, updateLot);
router.get("/:id/stats", protect, getLotStats);

router.get("/admin/all", protectAdmin, getLotsForAdmin);
router.patch("/:id/review", protectAdmin, reviewLotApproval);

module.exports = router;
