const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const ValetBooking = require("../models/ValetBooking");
const ParkingLot = require("../models/ParkingLot");
const Session = require("../models/Session");
const Commission = require("../models/Commission");
const { generateSessionToken } = require("../utils/generateToken");

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = "https://api.paystack.co";
const isTestMode = () =>
  !PAYSTACK_SECRET || PAYSTACK_SECRET === "sk_test_simulation";

const generateBookingToken = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const createValetBooking = async (req, res) => {
  try {
    const { lotCode, driverName, driverPhone, plateNumber, email } = req.body;
    const lot = await ParkingLot.findOne({ shortCode: lotCode.toUpperCase() });
    if (!lot) return res.status(404).json({ message: "Parking lot not found" });

    if (!driverName || !driverPhone) {
      return res.status(400).json({ message: "Name and phone are required" });
    }

    let token = generateBookingToken();
    while (await ValetBooking.findOne({ token }))
      token = generateBookingToken();

    const bookingId = uuidv4();
    const booking = await ValetBooking.create({
      bookingId,
      lotId: lot._id,
      driverName,
      driverPhone,
      plateNumber: plateNumber || "",
      valetFee: lot.valetFee,
      token,
      paymentStatus: "pending",
      status: "booked",
    });

    if (isTestMode()) {
      const reference = `SIMVALET_${uuidv4().split("-")[0].toUpperCase()}`;
      booking.paymentReference = reference;
      await booking.save();
      return res.status(201).json({
        message: "Booking created — complete payment to confirm",
        bookingId: booking.bookingId,
        authorizationUrl: `${process.env.FRONTEND_URL}/valet/simulate/${booking.bookingId}?reference=${reference}&amount=${lot.valetFee}`,
        reference,
        amount: lot.valetFee,
        testMode: true,
      });
    }

    const response = await axios.post(
      `${PAYSTACK_BASE}/transaction/initialize`,
      {
        email: email || `valet_${bookingId}@parkpay.ng`,
        amount: lot.valetFee * 100,
        metadata: { bookingId: booking.bookingId, type: "valet" },
        callback_url: `${process.env.FRONTEND_URL}/valet/verify?bookingId=${booking.bookingId}`,
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          "Content-Type": "application/json",
        },
      },
    );

    booking.paymentReference = response.data.data.reference;
    await booking.save();

    res.status(201).json({
      message: "Booking created — complete payment to confirm",
      bookingId: booking.bookingId,
      authorizationUrl: response.data.data.authorization_url,
      reference: response.data.data.reference,
      amount: lot.valetFee,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const markValetPaid = async (booking) => {
  booking.paymentStatus = "paid";
  await booking.save();

  const lot = await ParkingLot.findById(booking.lotId);
  const commissionPercentage = lot.commissionPercentage ?? 5;
  const commissionAmount = Math.round(
    booking.valetFee * (commissionPercentage / 100),
  );

  await Commission.create({
    commissionId: uuidv4(),
    lotId: lot._id,
    lotName: lot.name,
    sessionId: booking._id,
    sessionToken: `VALET-${booking.token}`,
    paymentMethod: "online",
    reference: booking.paymentReference,
    amountCharged: booking.valetFee,
    commissionPercentage,
    commissionAmount,
    ownerPayout: booking.valetFee - commissionAmount,
  });
};

const simulateValetPayment = async (req, res) => {
  try {
    if (!isTestMode())
      return res
        .status(403)
        .json({
          message:
            "Simulated payments are disabled — a live Paystack key is configured",
        });

    const { bookingId } = req.params;
    const { outcome } = req.body;
    const booking = await ValetBooking.findOne({ bookingId });
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (outcome === "success") {
      await markValetPaid(booking);
      return res.json({
        message: "Simulated valet payment successful",
        booking,
      });
    }
    return res.status(400).json({ message: "Simulated payment failed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const verifyValetPayment = async (req, res) => {
  try {
    const { reference, bookingId } = req.query;

    if (reference?.startsWith("SIMVALET_")) {
      const booking = await ValetBooking.findOne({ bookingId });
      if (!booking)
        return res.status(404).json({ message: "Booking not found" });
      return res.json({ booking });
    }

    const response = await axios.get(
      `${PAYSTACK_BASE}/transaction/verify/${reference}`,
      {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
      },
    );

    const booking = await ValetBooking.findOne({
      bookingId: bookingId || response.data.data.metadata.bookingId,
    });
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (response.data.data.status === "success") {
      await markValetPaid(booking);
      return res.json({ message: "Valet payment successful", booking });
    }
    return res.status(400).json({ message: "Payment failed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getBookingByToken = async (req, res) => {
  try {
    const booking = await ValetBooking.findOne({ token: req.params.token });
    if (!booking)
      return res
        .status(404)
        .json({ message: "No booking found with that token" });
    res.json({ booking });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const checkInValet = async (req, res) => {
  try {
    const { token } = req.params;
    const { spotNumber } = req.body;
    const booking = await ValetBooking.findOne({ token });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.paymentStatus !== "paid")
      return res
        .status(400)
        .json({ message: "This booking has not been paid for yet" });
    if (booking.status !== "booked")
      return res
        .status(400)
        .json({ message: `Booking already ${booking.status}` });

    let sessionToken = generateSessionToken();
    while (await Session.findOne({ sessionToken }))
      sessionToken = generateSessionToken();

    const session = await Session.create({
      sessionToken,
      lotId: booking.lotId,
      plateNumber: booking.plateNumber || null,
      spotNumber: spotNumber || null,
      driverPhone: booking.driverPhone,
      status: "active",
      entryTime: new Date(),
      allowedInAt: new Date(),
      attendantId: req.attendant.id,
      amountDue: 0,
      amountPaid: booking.valetFee,
      paymentMethod: "online",
      notes: `Valet booking ${booking.token} — pre-paid ₦${booking.valetFee}`,
    });

    booking.status = "checked-in";
    booking.sessionId = session._id;
    await booking.save();

    res.json({ message: "Valet checked in", session, booking });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getLotValetBookings = async (req, res) => {
  try {
    const { lotId } = req.params;
    const bookings = await ValetBooking.find({
      lotId,
      status: { $in: ["booked", "checked-in"] },
    }).sort({ createdAt: -1 });
    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createValetBooking,
  simulateValetPayment,
  verifyValetPayment,
  getBookingByToken,
  checkInValet,
  getLotValetBookings,
};
