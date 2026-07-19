const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const attendantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    pin: { type: String, required: true },
    lotId: { type: mongoose.Schema.Types.ObjectId, ref: 'ParkingLot', required: true },
    role: { type: String, enum: ['attendant', 'supervisor', 'owner'], default: 'attendant' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

attendantSchema.pre('save', async function (next) {
  if (!this.isModified('pin')) return next();
  this.pin = await bcrypt.hash(this.pin, 10);
  next();
});

attendantSchema.methods.comparePin = async function (pin) {
  return bcrypt.compare(pin, this.pin);
};

module.exports = mongoose.model('Attendant', attendantSchema);
