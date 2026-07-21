const Session = require('../models/Session');
const ParkingLot = require('../models/ParkingLot');
const { generateSessionToken } = require('../utils/generateToken');
const { calculateAmount, formatDuration } = require('../utils/calculateAmount');
const mongoose = require('mongoose');

const initSession = async (req, res) => {
  try {
    const { lotId, plateNumber, driverPhone } = req.body;
    const lot = await ParkingLot.findById(lotId);
    if (!lot) return res.status(404).json({ message: 'Parking lot not found' });

    let token = generateSessionToken();
    let exists = await Session.findOne({ sessionToken: token });
    while (exists) {
      token = generateSessionToken();
      exists = await Session.findOne({ sessionToken: token });
    }

    const session = await Session.create({
      sessionToken: token,
      lotId,
      plateNumber: plateNumber || null,
      driverPhone: driverPhone || null,
      status: 'pending',
    });

    res.status(201).json({
      message: 'Session created — waiting for attendant',
      session: {
        id: session._id,
        sessionToken: session.sessionToken,
        status: session.status,
        lotName: lot.name,
        lotAddress: lot.address,
        ratePerHour: lot.ratePerHour,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const findSession = async (req, res) => {
  try {
    const { lotId, plateNumber } = req.query;
    if (!lotId || !plateNumber) {
      return res
        .status(400)
        .json({ message: "lotId and plateNumber are required" });
    }

    const session = await Session.findOne({
      lotId,
      plateNumber: { $regex: `^${plateNumber.trim()}$`, $options: "i" },
      status: {
        $in: ["pending", "active", "pending-payment", "paid", "cash-paid"],
      },
    }).sort({ createdAt: -1 });

    if (!session) {
      return res
        .status(404)
        .json({ message: "No active session found for that plate number" });
    }

    res.json({
      sessionToken: session.sessionToken,
      status: session.status,
      redirectTo: ["paid", "cash-paid"].includes(session.status)
        ? "receipt"
        : "session",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getSessionByToken = async (req, res) => {
  try {
    const { token } = req.params;
    const session = await Session.findOne({ sessionToken: token }).populate('lotId');
    if (!session) return res.status(404).json({ message: 'Session not found' });

    const lot = session.lotId;
    const now = new Date();
    let currentAmount = 0;
    let duration = '';

    if (session.status === 'active' || session.status === 'pending-payment') {
      currentAmount = calculateAmount(session.entryTime, now, lot.ratePerHour, lot.minimumCharge, lot.gracePeriodMinutes);
      duration = formatDuration(session.entryTime, now);
    }

    res.json({
      session: {
        id: session._id,
        sessionToken: session.sessionToken,
        status: session.status,
        plateNumber: session.plateNumber,
        spotNumber: session.spotNumber,
        entryTime: session.entryTime,
        exitTime: session.exitTime,
        duration,
        currentAmount,
        amountDue: session.amountDue,
        amountPaid: session.amountPaid,
        paymentMethod: session.paymentMethod,
        exitWindowStart: session.exitWindowStart,
        lotName: lot.name,
        lotAddress: lot.address,
        ratePerHour: lot.ratePerHour,
        minimumCharge: lot.minimumCharge,
        exitWindowMinutes: lot.exitWindowMinutes,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const requestPayment = async (req, res) => {
  try {
    const { token } = req.params;
    const session = await Session.findOne({ sessionToken: token }).populate('lotId');
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (session.status !== 'active') return res.status(400).json({ message: `Session is ${session.status}` });

    const lot = session.lotId;
    const amount = calculateAmount(session.entryTime, new Date(), lot.ratePerHour, lot.minimumCharge, lot.gracePeriodMinutes);
    const duration = formatDuration(session.entryTime, new Date());

    session.amountDue = amount;
    session.status = 'pending-payment';
    await session.save();

    res.json({ message: 'Payment requested', sessionToken: session.sessionToken, amountDue: amount, duration, lotName: lot.name });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const allowEntry = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { spotNumber } = req.body;
    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (session.status !== 'pending') return res.status(400).json({ message: 'Session already processed' });

    session.status = 'active';
    session.entryTime = new Date();
    session.allowedInAt = new Date();
    session.spotNumber = spotNumber || null;
    session.attendantId = req.attendant.id;
    await session.save();

    res.json({ message: 'Entry allowed', session });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const confirmExit = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (!['paid', 'cash-paid'].includes(session.status)) return res.status(400).json({ message: 'Payment not confirmed yet' });

    session.status = 'completed';
    session.exitTime = new Date();
    await session.save();

    res.json({ message: 'Exit confirmed', session });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const markCashPaid = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { notes } = req.body;
    const session = await Session.findById(sessionId).populate('lotId');
    if (!session) return res.status(404).json({ message: 'Session not found' });

    const lot = session.lotId;
    const amount = calculateAmount(session.entryTime, new Date(), lot.ratePerHour, lot.minimumCharge, lot.gracePeriodMinutes);

    session.amountDue = amount;
    session.amountPaid = amount;
    session.status = 'cash-paid';
    session.paymentMethod = 'cash';
    session.exitWindowStart = new Date();
    session.notes = notes || 'Cash paid manually';
    await session.save();

    res.json({ message: 'Marked as cash paid', session });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const waiveFee = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { notes } = req.body;
    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    session.status = 'waived';
    session.paymentMethod = 'waived';
    session.amountDue = 0;
    session.amountPaid = 0;
    session.exitTime = new Date();
    session.notes = notes || 'Fee waived by attendant';
    await session.save();

    res.json({ message: 'Fee waived', session });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createManualSession = async (req, res) => {
  try {
    const { lotId, plateNumber, spotNumber, driverPhone, notes } = req.body;
    const lot = await ParkingLot.findById(lotId);
    if (!lot) return res.status(404).json({ message: 'Lot not found' });

    let token = generateSessionToken();
    let exists = await Session.findOne({ sessionToken: token });
    while (exists) {
      token = generateSessionToken();
      exists = await Session.findOne({ sessionToken: token });
    }

    const session = await Session.create({
      sessionToken: token,
      lotId,
      plateNumber: plateNumber || null,
      spotNumber: spotNumber || null,
      driverPhone: driverPhone || null,
      status: 'active',
      entryTime: new Date(),
      allowedInAt: new Date(),
      attendantId: req.attendant.id,
      notes: notes || 'Manual entry by attendant',
    });

    res.status(201).json({ message: 'Manual session created', session });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getActiveSessions = async (req, res) => {
  try {
    const { lotId } = req.params;
    const sessions = await Session.find({
      lotId,
      status: { $in: ['pending', 'active', 'pending-payment', 'paid', 'cash-paid'] },
    }).sort({ entryTime: -1 });

    const lot = await ParkingLot.findById(lotId);

    const enriched = sessions.map((s) => {
      const now = new Date();
      const currentAmount = s.status === 'active' || s.status === 'pending-payment'
        ? calculateAmount(s.entryTime, now, lot.ratePerHour, lot.minimumCharge, lot.gracePeriodMinutes)
        : s.amountDue;
      const duration = s.status === 'active' || s.status === 'pending-payment'
        ? formatDuration(s.entryTime, now)
        : formatDuration(s.entryTime, s.exitTime || now);

      return {
        id: s._id,
        sessionToken: s.sessionToken,
        plateNumber: s.plateNumber,
        spotNumber: s.spotNumber,
        status: s.status,
        entryTime: s.entryTime,
        duration,
        currentAmount,
        amountDue: s.amountDue,
        paymentMethod: s.paymentMethod,
        notes: s.notes,
      };
    });

    res.json({ sessions: enriched });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const syncOfflineSessions = async (req, res) => {
  try {
    const { sessions } = req.body;
    const results = [];
    for (const s of sessions) {
      try {
        let token = s.sessionToken || generateSessionToken();
        const exists = await Session.findOne({ sessionToken: token });
        if (exists) { results.push({ token, status: 'already exists' }); continue; }
        const session = await Session.create({
          sessionToken: token,
          lotId: s.lotId,
          plateNumber: s.plateNumber || null,
          spotNumber: s.spotNumber || null,
          status: s.status || 'cash-paid',
          entryTime: s.entryTime,
          exitTime: s.exitTime || null,
          amountDue: s.amountDue || 0,
          amountPaid: s.amountPaid || 0,
          paymentMethod: s.paymentMethod || 'cash',
          attendantId: req.attendant.id,
          notes: s.notes || 'Synced from offline',
          isOffline: true,
        });
        results.push({ token: session.sessionToken, status: 'synced' });
      } catch (e) {
        results.push({ token: s.sessionToken, status: 'error', error: e.message });
      }
    }
    res.json({ message: 'Sync complete', results });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getSessionHistory = async (req, res) => {
  try {
    const { lotId } = req.params;
    const { page = 1, limit = 20, date } = req.query;
    const filter = { lotId };

    if (date) {
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end = new Date(date); end.setHours(23, 59, 59, 999);
      filter.entryTime = { $gte: start, $lte: end };
    }

    const sessions = await Session.find(filter).sort({ entryTime: -1 }).skip((page - 1) * limit).limit(Number(limit));
    const total = await Session.countDocuments(filter);
    const revenue = await Session.aggregate([
      { $match: { lotId: new mongoose.Types.ObjectId(lotId), status: { $in: ['paid', 'cash-paid', 'completed'] } } },
      { $group: { _id: null, total: { $sum: '$amountPaid' } } },
    ]);

    res.json({ sessions, total, page: Number(page), totalPages: Math.ceil(total / limit), totalRevenue: revenue[0]?.total || 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  initSession,
  findSession,
  getSessionByToken,
  requestPayment,
  allowEntry,
  confirmExit,
  markCashPaid,
  waiveFee,
  createManualSession,
  getActiveSessions,
  syncOfflineSessions,
  getSessionHistory,
};
