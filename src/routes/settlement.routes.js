const express = require("express");
const router = express.Router();
const { protect, protectAdmin } = require("../middleware/auth");
const {
  createSettlement,
  getMySettlements,
  getAllSettlements,
  getSettlementById,
  reviewSettlement,
} = require("../controllers/settlement.controller");

router.post("/", protect, createSettlement);
router.get("/mine", protect, getMySettlements);

router.get("/", protectAdmin, getAllSettlements);
router.get("/:id", protectAdmin, getSettlementById);
router.patch("/:id/review", protectAdmin, reviewSettlement);

module.exports = router;
