const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['online', 'cash', 'waived'], required: true },
    paystackReference: { type: String, default: null },
    paystackStatus: { type: String, default: null },
    status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
