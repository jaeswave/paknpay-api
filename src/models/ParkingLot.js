const mongoose = require("mongoose");

const parkingLotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    phone: { type: String, default: null },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attendant",
      default: null,
    },
    shortCode: { type: String, required: true, unique: true },
    totalSpots: { type: Number, default: 0 },
    ratePerHour: { type: Number, required: true },
    minimumCharge: { type: Number, default: 200 },
    gracePeriodMinutes: { type: Number, default: 10 },
    exitWindowMinutes: { type: Number, default: 10 },
    commissionPercentage: { type: Number, default: 5 },
    valetFee: { type: Number, default: 1500 }, // see note above — adjust if you meant a different amount
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ParkingLot", parkingLotSchema);
