const mongoose = require('mongoose');

const parkingLotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    phone: { type: String },
    totalSpots: { type: Number, default: 0 },
    ratePerHour: { type: Number, required: true },
    minimumCharge: { type: Number, default: 200 },
    gracePeriodMinutes: { type: Number, default: 10 },
    exitWindowMinutes: { type: Number, default: 10 },
    commissionPercentage: { type: Number, default: 5 }, // platform's cut of each online payment — cash is free per pricing model
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendant' },
    isActive: { type: Boolean, default: true },
    shortCode: { type: String, unique: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ParkingLot', parkingLotSchema);
