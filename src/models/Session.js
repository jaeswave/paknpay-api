const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    sessionToken: { type: String, required: true, unique: true },
    lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'ParkingLot', required: true },
    plateNumber: { type: String, default: null },
    spotNumber: { type: String, default: null },
    driverPhone: { type: String, default: null },
    entryTime: { type: Date, default: Date.now },
    exitTime: { type: Date, default: null },
    amountDue: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'active', 'pending-payment', 'paid', 'cash-paid', 'completed', 'waived', 'offline'],
      default: 'pending',
    },
    paymentMethod: { type: String, enum: ['online', 'cash', 'waived', null], default: null },
    paymentReference: { type: String, default: null },
    attendantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendant', default: null },
    allowedInAt: { type: Date, default: null },
    exitWindowStart: { type: Date, default: null },
    notes: { type: String, default: null },
    isOffline: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Session', sessionSchema);
