const { v4: uuidv4 } = require("uuid");
const Settlement = require("../models/Settlement");
const Commission = require("../models/Commission");
const ParkingLot = require("../models/ParkingLot");

const createSettlement = async (req, res) => {
  try {
    const lotId = req.attendant.lotId;
    const { transferNote, receiptImage } = req.body;

    if (!receiptImage) {
      return res
        .status(400)
        .json({ message: "Please attach a receipt/proof of transfer" });
    }

    const unsettled = await Commission.find({ lotId, settled: false });
    if (unsettled.length === 0) {
      return res
        .status(400)
        .json({
          message: "Nothing owed right now — no unsettled commission found",
        });
    }

    const amount = unsettled.reduce((sum, c) => sum + c.commissionAmount, 0);
    const lot = await ParkingLot.findById(lotId);
    const settlementId = uuidv4();

    const settlement = await Settlement.create({
      settlementId,
      lotId,
      lotName: lot.name,
      amount,
      commissionIds: unsettled.map((c) => c._id),
      transferNote: transferNote || "",
      receiptImage,
      status: "pending_review",
    });

    res
      .status(201)
      .json({
        message: "Settlement submitted — awaiting confirmation",
        settlement,
      });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMySettlements = async (req, res) => {
  try {
    const lotId = req.attendant.lotId;
    const settlements = await Settlement.find({ lotId })
      .sort({ createdAt: -1 })
      .select("-receiptImage");
    res.json({ settlements });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getAllSettlements = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const settlements = await Settlement.find(filter)
      .sort({ createdAt: -1 })
      .select("-receiptImage");
    res.json({ settlements });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getSettlementById = async (req, res) => {
  try {
    const settlement = await Settlement.findById(req.params.id);
    if (!settlement)
      return res.status(404).json({ message: "Settlement not found" });
    res.json({ settlement });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const reviewSettlement = async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, reviewNote } = req.body;

    if (!["confirmed", "rejected"].includes(decision)) {
      return res
        .status(400)
        .json({ message: "decision must be 'confirmed' or 'rejected'" });
    }

    const settlement = await Settlement.findById(id);
    if (!settlement)
      return res.status(404).json({ message: "Settlement not found" });
    if (settlement.status !== "pending_review") {
      return res.status(400).json({ message: `Already ${settlement.status}` });
    }

    settlement.status = decision;
    settlement.reviewedAt = new Date();
    settlement.reviewNote = reviewNote || "";
    await settlement.save();

    if (decision === "confirmed") {
      await Commission.updateMany(
        { _id: { $in: settlement.commissionIds } },
        { $set: { settled: true, settlementId: settlement._id } },
      );
    }

    res.json({ message: `Settlement ${decision}`, settlement });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createSettlement,
  getMySettlements,
  getAllSettlements,
  getSettlementById,
  reviewSettlement,
};
