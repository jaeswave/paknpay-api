const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const attendantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    pin: { type: String, required: true },
    dashboardPin: { type: String, default: null },
    lotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingLot",
      required: true,
    },
    role: {
      type: String,
      enum: ["attendant", "supervisor", "owner"],
      default: "attendant",
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

attendantSchema.pre("save", async function (next) {
  if (this.isModified("pin")) this.pin = await bcrypt.hash(this.pin, 10);
  if (this.isModified("dashboardPin") && this.dashboardPin) {
    this.dashboardPin = await bcrypt.hash(this.dashboardPin, 10);
  }
  next();
});

attendantSchema.methods.comparePin = async function (pin) {
  return bcrypt.compare(pin, this.pin);
};

attendantSchema.methods.compareDashboardPin = async function (pin) {
  if (!this.dashboardPin) return false;
  return bcrypt.compare(pin, this.dashboardPin);
};

module.exports = mongoose.model("Attendant", attendantSchema);
