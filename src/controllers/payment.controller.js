const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const Session = require('../models/Session');
const Payment = require('../models/Payment');
const Commission = require('../models/Commission');
const { calculateAmount } = require('../utils/calculateAmount');

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';

// TEST MODE: if there's no real Paystack key configured (or it's explicitly
// set to this placeholder), we skip the real Paystack API entirely and send
// the driver to a local simulated checkout page instead. This lets you test
// the FULL flow (pay -> verify -> exit countdown) with zero Paystack account,
// zero test keys, and zero internet dependency on Paystack's API.
const isTestMode = () => !PAYSTACK_SECRET || PAYSTACK_SECRET === 'sk_test_simulation';

// Records the platform's commission on a successful ONLINE payment.
// Cash and waived sessions never call this — per the pricing model,
// cash payments are commission-free (only online payments are taxed).
const recordCommission = async (session, lot, amount, reference) => {
  const commissionPercentage = lot.commissionPercentage ?? 5;
  const commissionAmount = Math.round(amount * (commissionPercentage / 100));

  await Commission.create({
    commissionId: uuidv4(),
    lotId: lot._id,
    lotName: lot.name,
    sessionId: session._id,
    sessionToken: session.sessionToken,
    paymentMethod: 'online',
    reference: reference || null,
    amountCharged: amount,
    commissionPercentage,
    commissionAmount,
    ownerPayout: amount - commissionAmount,
  });
};

const initializePayment = async (req, res) => {
  try {
    const { sessionToken, email } = req.body;
    const session = await Session.findOne({ sessionToken }).populate('lotId');
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (!['active', 'pending-payment'].includes(session.status))
      return res.status(400).json({ message: `Cannot pay — session is ${session.status}` });

    const lot = session.lotId;
    const amount = calculateAmount(session.entryTime, new Date(), lot.ratePerHour, lot.minimumCharge, lot.gracePeriodMinutes);

    if (amount === 0) {
      session.status = 'paid';
      session.amountDue = 0;
      session.amountPaid = 0;
      session.paymentMethod = 'waived';
      session.exitWindowStart = new Date();
      await session.save();
      return res.json({ message: 'Free exit — within grace period', free: true, session });
    }

    // ========== TEST MODE: simulate instead of calling real Paystack ==========
    if (isTestMode()) {
      const reference = `SIM_${uuidv4().split('-')[0].toUpperCase()}`;

      session.status = 'pending-payment';
      session.amountDue = amount;
      session.paymentReference = reference;
      await session.save();

      await Payment.create({ sessionId: session._id, amount, method: 'online', paystackReference: reference, status: 'pending' });

      // Instead of a real Paystack authorization_url, send the frontend to
      // our own local simulated checkout page — same shape of response
      // (authorizationUrl, reference, amount) so the frontend code doesn't
      // need to know or care whether it's test mode or real Paystack.
      return res.json({
        authorizationUrl: `${process.env.FRONTEND_URL}/pay/simulate/${sessionToken}?reference=${reference}&amount=${amount}`,
        reference,
        amount,
        sessionToken,
        testMode: true,
      });
    }
    // ========== END TEST MODE ==========

    const response = await axios.post(
      `${PAYSTACK_BASE}/transaction/initialize`,
      {
        email: email || `park_${sessionToken}@parkpay.ng`,
        amount: amount * 100,
        metadata: { sessionToken, sessionId: session._id, lotName: lot.name },
        callback_url: `${process.env.FRONTEND_URL}/pay/verify?token=${sessionToken}`,
      },
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' } }
    );

    const { authorization_url, reference } = response.data.data;
    session.status = 'pending-payment';
    session.amountDue = amount;
    session.paymentReference = reference;
    await session.save();

    await Payment.create({ sessionId: session._id, amount, method: 'online', paystackReference: reference, status: 'pending' });

    res.json({ authorizationUrl: authorization_url, reference, amount, sessionToken });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Called only by the local simulated checkout page (test mode). Never
// reachable in production once a real PAYSTACK_SECRET_KEY is set, since
// initializePayment will never hand out a /pay/simulate URL in that case.
const simulatePayment = async (req, res) => {
  try {
    if (!isTestMode()) {
      return res.status(403).json({ message: 'Simulated payments are disabled — a live Paystack key is configured' });
    }

    const { reference } = req.params;
    const { outcome } = req.body; // 'success' | 'failed'

    const payment = await Payment.findOne({ paystackReference: reference });
    if (!payment) return res.status(404).json({ message: 'Simulated transaction not found' });

    const session = await Session.findById(payment.sessionId).populate('lotId');
    if (!session) return res.status(404).json({ message: 'Session not found' });

    if (outcome === 'success') {
      const lot = session.lotId;
      session.status = 'paid';
      session.amountPaid = payment.amount;
      session.paymentMethod = 'online';
      session.exitWindowStart = new Date();
      await session.save();

      payment.status = 'success';
      payment.paystackStatus = 'success (simulated)';
      payment.paidAt = new Date();
      await payment.save();

      await recordCommission(session, lot, payment.amount, reference);

      return res.json({
        message: 'Simulated payment successful',
        session: { sessionToken: session.sessionToken, amountPaid: session.amountPaid, exitWindowStart: session.exitWindowStart, status: session.status },
      });
    } else {
      payment.status = 'failed';
      payment.paystackStatus = 'failed (simulated)';
      await payment.save();
      return res.status(400).json({ message: 'Simulated payment failed' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { reference, token } = req.query;

    // A simulated reference should never reach real verification — if it
    // somehow does (e.g. stale link), just read back what simulatePayment
    // already recorded instead of calling the real Paystack API with a
    // reference Paystack has never heard of.
    if (reference?.startsWith('SIM_')) {
      const session = await Session.findOne({ sessionToken: token });
      if (!session) return res.status(404).json({ message: 'Session not found' });
      return res.json({ message: 'Simulated session status', session: { sessionToken: session.sessionToken, amountPaid: session.amountPaid, exitWindowStart: session.exitWindowStart, status: session.status } });
    }

    const response = await axios.get(`${PAYSTACK_BASE}/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    });

    const { status, amount, metadata } = response.data.data;
    const session = await Session.findOne({ sessionToken: token || metadata.sessionToken }).populate('lotId');
    if (!session) return res.status(404).json({ message: 'Session not found' });

    const payment = await Payment.findOne({ paystackReference: reference });

    if (status === 'success') {
      session.status = 'paid';
      session.amountPaid = amount / 100;
      session.paymentMethod = 'online';
      session.exitWindowStart = new Date();
      await session.save();
      if (payment) { payment.status = 'success'; payment.paystackStatus = status; payment.paidAt = new Date(); await payment.save(); }

      await recordCommission(session, session.lotId, session.amountPaid, reference);

      return res.json({ message: 'Payment successful', session: { sessionToken: session.sessionToken, amountPaid: session.amountPaid, exitWindowStart: session.exitWindowStart, status: session.status } });
    } else {
      if (payment) { payment.status = 'failed'; await payment.save(); }
      return res.status(400).json({ message: 'Payment failed' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const webhook = async (req, res) => {
  try {
    const event = req.body;
    if (event.event === 'charge.success') {
      const { reference, metadata } = event.data;
      const session = await Session.findOne({ sessionToken: metadata.sessionToken }).populate('lotId');
      if (session && session.status === 'pending-payment') {
        session.status = 'paid';
        session.amountPaid = event.data.amount / 100;
        session.paymentMethod = 'online';
        session.exitWindowStart = new Date();
        await session.save();
        await Payment.findOneAndUpdate({ paystackReference: reference }, { status: 'success', paidAt: new Date() });
        await recordCommission(session, session.lotId, session.amountPaid, reference);
      }
    }
    res.sendStatus(200);
  } catch (err) {
    res.sendStatus(500);
  }
};

// ========== Commission ledger + summary (platform-level, across all lots) ==========

const getCommissionLedger = async (req, res) => {
  try {
    const { lotId, page = 1, limit = 20 } = req.query;
    const filter = lotId ? { lotId } : {};

    const total = await Commission.countDocuments(filter);
    const records = await Commission.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ records, total, page: Number(page), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getCommissionSummary = async (req, res) => {
  try {
    const { lotId } = req.query;
    const filter = lotId ? { lotId } : {};

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const sumSince = async (since) => {
      const result = await Commission.aggregate([
        { $match: { ...filter, createdAt: { $gte: since } } },
        { $group: { _id: null, total: { $sum: '$commissionAmount' }, count: { $sum: 1 } } },
      ]);
      return { total: result[0]?.total || 0, count: result[0]?.count || 0 };
    };

    const [allTime, today, thisWeek, thisMonth] = await Promise.all([
      Commission.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: '$commissionAmount' }, count: { $sum: 1 } } }]),
      sumSince(startOfToday),
      sumSince(startOfWeek),
      sumSince(startOfMonth),
    ]);

    res.json({
      allTimeTotal: allTime[0]?.total || 0,
      allTimeCount: allTime[0]?.count || 0,
      today,
      thisWeek,
      thisMonth,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { initializePayment, verifyPayment, simulatePayment, webhook, getCommissionLedger, getCommissionSummary };
