const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  createValetBooking,
  simulateValetPayment,
  verifyValetPayment,
  getBookingByToken,
  checkInValet,
  getLotValetBookings,
} = require("../controllers/valet.controller");

router.post("/book", createValetBooking);
router.post("/simulate/:bookingId", simulateValetPayment);
router.get("/verify", verifyValetPayment);
router.get("/token/:token", getBookingByToken);

router.patch("/token/:token/check-in", protect, checkInValet);
router.get("/lot/:lotId", protect, getLotValetBookings);

module.exports = router;
