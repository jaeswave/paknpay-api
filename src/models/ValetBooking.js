const mongoose = require("mongoose");

const valetBookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, required: true, unique: true },
    lotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingLot",
      required: true,
    },
    driverName: { type: String, required: true },
    driverPhone: { type: String, required: true },
    plateNumber: { type: String, default: "" },
    valetFee: { type: Number, required: true },
    token: { type: String, required: true, unique: true },
    paymentReference: { type: String, default: null },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
    },
    status: {
      type: String,
      enum: ["booked", "checked-in", "completed", "cancelled"],
      default: "booked",
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      default: null,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ValetBooking", valetBookingSchema);
