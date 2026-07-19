const mongoose = require('mongoose');

const commissionSchema = new mongoose.Schema(
  {
    commissionId: { type: String, required: true, unique: true },
    lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'ParkingLot', required: true },
    lotName: { type: String },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    sessionToken: { type: String },
    paymentMethod: { type: String, enum: ['online'], default: 'online' }, // only online payments earn commission — cash/waived are free per pricing model
    reference: { type: String, default: null },
    amountCharged: { type: Number, required: true },
    commissionPercentage: { type: Number, required: true },
    commissionAmount: { type: Number, required: true },
    ownerPayout: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Commission', commissionSchema);
