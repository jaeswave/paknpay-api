const Attendant = require('../models/Attendant');
const ParkingLot = require('../models/ParkingLot');
const jwt = require('jsonwebtoken');

const signToken = (attendant) =>
  jwt.sign(
    { id: attendant._id, lotId: attendant.lotId, role: attendant.role },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );

const login = async (req, res) => {
  try {
    const { phone, pin } = req.body;
    const attendant = await Attendant.findOne({ phone, isActive: true });
    if (!attendant) return res.status(404).json({ message: 'Attendant not found' });
    const isMatch = await attendant.comparePin(pin);
    if (!isMatch) return res.status(401).json({ message: 'Invalid PIN' });
    const token = signToken(attendant);
    res.json({
      message: 'Login successful', token,
      attendant: { id: attendant._id, name: attendant.name, phone: attendant.phone, role: attendant.role, lotId: attendant.lotId },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ========== ONE-CALL OWNER SIGNUP ==========
// Creates the ParkingLot and the owner Attendant together in the right
// order, so there's never a moment where an Attendant document exists with
// a fake/placeholder lotId. Public (no auth) since the owner doesn't have a
// token yet at this point — that's the whole reason this exists instead of
// making the frontend juggle create-attendant -> login -> create-lot ->
// patch-attendant-lotId as three separate authenticated calls.
const signupOwner = async (req, res) => {
  try {
    const { name, phone, pin, lot } = req.body;
    if (!name || !phone || !pin) {
      return res.status(400).json({ message: 'Name, phone, and PIN are required' });
    }
    if (!lot || !lot.name || !lot.address || !lot.ratePerHour || !lot.shortCode) {
      return res.status(400).json({ message: 'Parking lot name, address, rate per hour, and short code are required' });
    }

    const existingAttendant = await Attendant.findOne({ phone });
    if (existingAttendant) return res.status(400).json({ message: 'Phone already registered' });

    const shortCode = lot.shortCode.toUpperCase().replace(/\s/g, '');
    const existingLot = await ParkingLot.findOne({ shortCode });
    if (existingLot) return res.status(400).json({ message: 'Short code already in use' });

    // Step 1: create the lot with no owner yet (ownerId is optional on the schema)
    const newLot = await ParkingLot.create({
      name: lot.name,
      address: lot.address,
      phone: lot.phone,
      totalSpots: Number(lot.totalSpots) || 0,
      ratePerHour: Number(lot.ratePerHour),
      minimumCharge: lot.minimumCharge ? Number(lot.minimumCharge) : 200,
      gracePeriodMinutes: lot.gracePeriodMinutes ? Number(lot.gracePeriodMinutes) : 10,
      shortCode,
    });

    // Step 2: create the owner attendant pointing at the real lot
    const attendant = await Attendant.create({ name, phone, pin, lotId: newLot._id, role: 'owner' });

    // Step 3: link the lot back to its owner
    newLot.ownerId = attendant._id;
    await newLot.save();

    const token = signToken(attendant);

    res.status(201).json({
      message: 'Account and parking lot created',
      token,
      attendant: { id: attendant._id, name: attendant.name, phone: attendant.phone, role: attendant.role, lotId: newLot._id },
      lot: newLot,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createAttendant = async (req, res) => {
  try {
    const { name, phone, pin, lotId, role } = req.body;
    const exists = await Attendant.findOne({ phone });
    if (exists) return res.status(400).json({ message: 'Phone already registered' });
    const attendant = await Attendant.create({ name, phone, pin, lotId, role });
    res.status(201).json({ message: 'Attendant created', attendant: { id: attendant._id, name: attendant.name, phone: attendant.phone } });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const getMe = async (req, res) => {
  try {
    const attendant = await Attendant.findById(req.attendant.id).select('-pin').populate('lotId');
    res.json({ attendant });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const updateLotId = async (req, res) => {
  try {
    const { lotId } = req.body;
    const attendant = await Attendant.findByIdAndUpdate(req.params.id, { lotId }, { new: true }).select('-pin');
    res.json({ message: 'Lot updated', attendant });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const getLotAttendants = async (req, res) => {
  try {
    const attendants = await Attendant.find({ lotId: req.params.lotId, role: { $ne: 'owner' } }).select('-pin');
    res.json({ attendants });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const addAttendant = async (req, res) => {
  try {
    const { name, phone, pin } = req.body;
    const lotId = req.attendant.lotId;
    const exists = await Attendant.findOne({ phone });
    if (exists) return res.status(400).json({ message: 'Phone already registered' });
    const attendant = await Attendant.create({ name, phone, pin, lotId, role: 'attendant' });
    res.status(201).json({ message: 'Attendant added', attendant: { id: attendant._id, name: attendant.name, phone: attendant.phone, role: attendant.role } });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const removeAttendant = async (req, res) => {
  try {
    await Attendant.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Attendant removed' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { login, signupOwner, createAttendant, getMe, updateLotId, getLotAttendants, addAttendant, removeAttendant };
