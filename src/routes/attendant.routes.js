const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  login,
  signupOwner,
  verifyDashboardPin,
  createAttendant,
  getMe,
  updateLotId,
  getLotAttendants,
  addAttendant,
  removeAttendant,
} = require("../controllers/attendant.controller");

router.post("/login", login);
router.post("/signup", signupOwner);
router.post("/verify-dashboard-pin", protect, verifyDashboardPin);
router.post("/create", createAttendant);
router.get("/me", protect, getMe);
router.patch("/:id/lot", protect, updateLotId);
router.get("/lot/:lotId", protect, getLotAttendants);
router.post("/add", protect, addAttendant);
router.patch("/:id/remove", protect, removeAttendant);

module.exports = router;
