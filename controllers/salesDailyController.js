// backend/controllers/salesDailyController.js

const SalesDaily = require('../models/SalesDaily');

// @desc    Get all sales‑daily records (read‑only)
// @route   GET /api/sales-daily
// @access  Public
exports.getAllSalesDaily = async (req, res) => {
  try {
    const records = await SalesDaily.find();
    return res.status(200).json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (err) {
    console.error('Error fetching all sales‑daily:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get a single sales‑daily record by its Firestore string _id
// @route   GET /api/sales-daily/:id
// @access  Public
exports.getSalesDailyById = async (req, res) => {
  try {
    const record = await SalesDaily.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Sales‑daily record not found' });
    }
    return res.status(200).json({ success: true, data: record });
  } catch (err) {
    console.error('Error fetching sales‑daily by id:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get all sales‑daily records for a specific productId (including orphan)
// @route   GET /api/sales-daily/product/:productId
// @access  Public
exports.getSalesDailyByProductId = async (req, res) => {
  try {
    const records = await SalesDaily.find({ productId: req.params.productId });
    return res.status(200).json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (err) {
    console.error('Error fetching sales‑daily by productId:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
