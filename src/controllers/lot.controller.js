const ParkingLot = require('../models/ParkingLot');

const createLot = async (req, res) => {
  try {
    const { name, address, phone, totalSpots, ratePerHour, minimumCharge, gracePeriodMinutes, shortCode } = req.body;
    const exists = await ParkingLot.findOne({ shortCode: shortCode.toUpperCase() });
    if (exists) return res.status(400).json({ message: 'Short code already in use' });
    const lot = await ParkingLot.create({
      name, address, phone, totalSpots, ratePerHour,
      minimumCharge: minimumCharge || 200,
      gracePeriodMinutes: gracePeriodMinutes || 10,
      shortCode: shortCode.toUpperCase(),
      ownerId: req.attendant.id,
    });
    res.status(201).json({ message: 'Parking lot created', lot });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getLotByShortCode = async (req, res) => {
  try {
    const lot = await ParkingLot.findOne({
      shortCode: req.params.code.toUpperCase(),
      isActive: true,
    }).select("-commissionPercentage");
    if (!lot) return res.status(404).json({ message: "Parking lot not found" });
    res.json({ lot });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getLotById = async (req, res) => {
  try {
    const lot = await ParkingLot.findById(req.params.id);
    if (!lot) return res.status(404).json({ message: 'Not found' });
    res.json({ lot });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateLot = async (req, res) => {
  try {
    const {
      name,
      address,
      phone,
      totalSpots,
      ratePerHour,
      minimumCharge,
      gracePeriodMinutes,
      valetFee,
    } = req.body;
    const lot = await ParkingLot.findByIdAndUpdate(
      req.params.id,
      {
        name,
        address,
        phone,
        totalSpots,
        ratePerHour,
        minimumCharge,
        gracePeriodMinutes,
        valetFee,
      },
      { new: true },
    );
    if (!lot) return res.status(404).json({ message: "Lot not found" });
    res.json({ message: "Lot updated", lot });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getLotStats = async (req, res) => {
  try {
    const Session = require('../models/Session');
    const mongoose = require('mongoose');
    const lotId = req.params.id;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);

    const [todayStats, weekStats, monthStats, activeSessions, totalSessions] = await Promise.all([
      Session.aggregate([
        { $match: { lotId: new mongoose.Types.ObjectId(lotId), status: { $in: ['paid', 'cash-paid', 'completed'] }, entryTime: { $gte: today } } },
        { $group: { _id: null, revenue: { $sum: '$amountPaid' }, count: { $sum: 1 } } }
      ]),
      Session.aggregate([
        { $match: { lotId: new mongoose.Types.ObjectId(lotId), status: { $in: ['paid', 'cash-paid', 'completed'] }, entryTime: { $gte: weekAgo } } },
        { $group: { _id: null, revenue: { $sum: '$amountPaid' }, count: { $sum: 1 } } }
      ]),
      Session.aggregate([
        { $match: { lotId: new mongoose.Types.ObjectId(lotId), status: { $in: ['paid', 'cash-paid', 'completed'] }, entryTime: { $gte: monthAgo } } },
        { $group: { _id: null, revenue: { $sum: '$amountPaid' }, count: { $sum: 1 } } }
      ]),
      Session.countDocuments({ lotId, status: { $in: ['pending', 'active', 'pending-payment'] } }),
      Session.countDocuments({ lotId }),
    ]);

    // Daily revenue for last 7 days
    const dailyRevenue = await Session.aggregate([
      { $match: { lotId: new mongoose.Types.ObjectId(lotId), status: { $in: ['paid', 'cash-paid', 'completed'] }, entryTime: { $gte: weekAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$entryTime' } }, revenue: { $sum: '$amountPaid' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      today: { revenue: todayStats[0]?.revenue || 0, sessions: todayStats[0]?.count || 0 },
      week: { revenue: weekStats[0]?.revenue || 0, sessions: weekStats[0]?.count || 0 },
      month: { revenue: monthStats[0]?.revenue || 0, sessions: monthStats[0]?.count || 0 },
      activeSessions,
      totalSessions,
      dailyRevenue,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createLot, getLotByShortCode, getLotById, updateLot, getLotStats };
