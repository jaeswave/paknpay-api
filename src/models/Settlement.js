const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema(
  {
    settlementId: { type: String, required: true, unique: true },
    lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'ParkingLot', required: true },
    lotName: { type: String },
    amount: { type: Number, required: true },
    commissionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Commission' }],
    transferNote: { type: String, default: '' },
    receiptImage: { type: String, default: null },
    status: { type: String, enum: ['pending_review', 'confirmed', 'rejected'], default: 'pending_review' },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settlement', settlementSchema);