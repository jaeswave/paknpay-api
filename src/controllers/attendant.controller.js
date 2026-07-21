const Attendant = require("../models/Attendant");
const ParkingLot = require("../models/ParkingLot");
const jwt = require("jsonwebtoken");

const signToken = (attendant) =>
  jwt.sign(
    { id: attendant._id, lotId: attendant.lotId, role: attendant.role },
    process.env.JWT_SECRET,
    { expiresIn: "12h" },
  );

const login = async (req, res) => {
  try {
    const { phone, pin } = req.body;
    const attendant = await Attendant.findOne({ phone, isActive: true });
    if (!attendant)
      return res.status(404).json({ message: "Attendant not found" });
    const isMatch = await attendant.comparePin(pin);
    if (!isMatch) return res.status(401).json({ message: "Invalid PIN" });
    const token = signToken(attendant);
    res.json({
      message: "Login successful",
      token,
      attendant: {
        id: attendant._id,
        name: attendant.name,
        phone: attendant.phone,
        role: attendant.role,
        lotId: attendant.lotId,
        hasDashboardPin: !!attendant.dashboardPin,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const signupOwner = async (req, res) => {
  try {
    const { name, phone, pin, dashboardPin, lot } = req.body;
    if (!name || !phone || !pin) {
      return res
        .status(400)
        .json({ message: "Name, phone, and PIN are required" });
    }
    if (!dashboardPin || dashboardPin.length !== 4) {
      return res
        .status(400)
        .json({ message: "A 4-digit dashboard PIN is required" });
    }
    if (
      !lot ||
      !lot.name ||
      !lot.address ||
      !lot.ratePerHour ||
      !lot.shortCode
    ) {
      return res
        .status(400)
        .json({
          message:
            "Parking lot name, address, rate per hour, and short code are required",
        });
    }

    const existingAttendant = await Attendant.findOne({ phone });
    if (existingAttendant)
      return res.status(400).json({ message: "Phone already registered" });

    const shortCode = lot.shortCode.toUpperCase().replace(/\s/g, "");
    const existingLot = await ParkingLot.findOne({ shortCode });
    if (existingLot)
      return res.status(400).json({ message: "Short code already in use" });

    const newLot = await ParkingLot.create({
      name: lot.name,
      address: lot.address,
      phone: lot.phone,
      totalSpots: Number(lot.totalSpots) || 0,
      ratePerHour: Number(lot.ratePerHour),
      minimumCharge: lot.minimumCharge ? Number(lot.minimumCharge) : 200,
      gracePeriodMinutes: lot.gracePeriodMinutes
        ? Number(lot.gracePeriodMinutes)
        : 10,
      valetFee: lot.valetFee ? Number(lot.valetFee) : 1500,
      shortCode,
    });

    const attendant = await Attendant.create({
      name,
      phone,
      pin,
      dashboardPin,
      lotId: newLot._id,
      role: "owner",
    });

    newLot.ownerId = attendant._id;
    await newLot.save();

    const token = signToken(attendant);

    res.status(201).json({
      message: "Account and parking lot created",
      token,
      attendant: {
        id: attendant._id,
        name: attendant.name,
        phone: attendant.phone,
        role: attendant.role,
        lotId: newLot._id,
        hasDashboardPin: true,
      },
      lot: newLot,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const verifyDashboardPin = async (req, res) => {
  try {
    const { pin } = req.body;
    const attendant = await Attendant.findById(req.attendant.id);
    if (!attendant)
      return res.status(404).json({ message: "Attendant not found" });
    if (attendant.role !== "owner")
      return res
        .status(403)
        .json({ message: "Only owners have a dashboard PIN" });

    const isMatch = await attendant.compareDashboardPin(pin);
    if (!isMatch)
      return res.status(401).json({ message: "Incorrect dashboard PIN" });

    res.json({ message: "PIN verified", verified: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createAttendant = async (req, res) => {
  try {
    const { name, phone, pin, lotId, role } = req.body;
    const exists = await Attendant.findOne({ phone });
    if (exists)
      return res.status(400).json({ message: "Phone already registered" });
    const attendant = await Attendant.create({ name, phone, pin, lotId, role });
    res
      .status(201)
      .json({
        message: "Attendant created",
        attendant: {
          id: attendant._id,
          name: attendant.name,
          phone: attendant.phone,
        },
      });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMe = async (req, res) => {
  try {
    const attendant = await Attendant.findById(req.attendant.id)
      .select("-pin -dashboardPin")
      .populate("lotId");
    res.json({ attendant });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateLotId = async (req, res) => {
  try {
    const { lotId } = req.body;
    const attendant = await Attendant.findByIdAndUpdate(
      req.params.id,
      { lotId },
      { new: true },
    ).select("-pin -dashboardPin");
    res.json({ message: "Lot updated", attendant });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getLotAttendants = async (req, res) => {
  try {
    const attendants = await Attendant.find({
      lotId: req.params.lotId,
      role: { $ne: "owner" },
    }).select("-pin -dashboardPin");
    res.json({ attendants });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const addAttendant = async (req, res) => {
  try {
    const { name, phone, pin } = req.body;
    const lotId = req.attendant.lotId;
    const exists = await Attendant.findOne({ phone });
    if (exists)
      return res.status(400).json({ message: "Phone already registered" });
    const attendant = await Attendant.create({
      name,
      phone,
      pin,
      lotId,
      role: "attendant",
    });
    res
      .status(201)
      .json({
        message: "Attendant added",
        attendant: {
          id: attendant._id,
          name: attendant.name,
          phone: attendant.phone,
          role: attendant.role,
        },
      });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const removeAttendant = async (req, res) => {
  try {
    await Attendant.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: "Attendant removed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  login,
  signupOwner,
  verifyDashboardPin,
  createAttendant,
  getMe,
  updateLotId,
  getLotAttendants,
  addAttendant,
  removeAttendant,
};
