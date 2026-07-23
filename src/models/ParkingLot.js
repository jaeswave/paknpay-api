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
    valetFee: { type: Number, default: 1500 },
    // New lots start pending — they can't operate (log in to any
    // dashboard, or take payments) until a platform admin approves them.
    approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ParkingLot", parkingLotSchema);
