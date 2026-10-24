// backend/controllers/salesController.js

const Sale = require('../models/Sale');

// @desc    Get all sales records (read‑only)
// @route   GET /api/sales
// @access  Public
exports.getAllSales = async (req, res) => {
  try {
    const sales = await Sale.find();
    return res.status(200).json({
      success: true,
      count: sales.length,
      data: sales,
    });
  } catch (err) {
    console.error('Error fetching all sales:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get a single sale by its Firestore string _id
// @route   GET /api/sales/:id
// @access  Public
exports.getSaleById = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }
    return res.status(200).json({ success: true, data: sale });
  } catch (err) {
    console.error('Error fetching sale by id:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get all sales for a specific productId (including orphan product)
// @route   GET /api/sales/product/:productId
// @access  Public
exports.getSalesByProductId = async (req, res) => {
  try {
    const sales = await Sale.find({ productId: req.params.productId });
    return res.status(200).json({
      success: true,
      count: sales.length,
      data: sales,
    });
  } catch (err) {
    console.error('Error fetching sales by productId:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// New: POST /api/sales – record a sale safely (standalone MongoDB)
// @desc    Record a new sale (atomic via compensating writes)
// @route   POST /api/sales
// @access  Public
const Inventory = require('../models/Inventory');
const SalesDaily = require('../models/SalesDaily');
const mongoose = require('mongoose');

exports.createSale = async (req, res) => {
  try {
    // ---------- Validation ----------
    const { productId, units, pricePerUnit, date } = req.body;
    if (!productId || typeof productId !== 'string' || !productId.trim()) {
      return res.status(400).json({ success: false, message: 'Invalid or missing productId' });
    }
    const numericUnits = Number(units);
    if (!Number.isFinite(numericUnits) || numericUnits <= 0) {
      return res.status(400).json({ success: false, message: 'Units must be a positive number' });
    }
    // ---------- Find product ----------
    const product = await Inventory.findById(productId).lean();
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    // ---------- Determine sale price ----------
    let salePrice;
    if (Number.isFinite(product.sellingPrice)) {
      salePrice = product.sellingPrice;
    } else if (Number.isFinite(product.price)) {
      salePrice = product.price;
    } else if (Number.isFinite(pricePerUnit)) {
      salePrice = pricePerUnit; // fallback if inventory lacks price info
    } else {
      return res.status(400).json({ success: false, message: 'Unable to determine sale price' });
    }
    // ---------- Normalise date ----------
    let saleDate;
    if (date) {
      const d = new Date(date);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid date format' });
      }
      // force midnight UTC
      saleDate = new Date(d.toISOString().slice(0, 10) + 'T00:00:00.000Z');
    } else {
      // use today at midnight UTC
      const now = new Date();
      saleDate = new Date(now.toISOString().slice(0, 10) + 'T00:00:00.000Z');
    }
    // ---------- Step 1: conditional stock decrement ----------
    const stockResult = await Inventory.updateOne(
      { _id: productId, stockLevel: { $gte: numericUnits } },
      { $inc: { stockLevel: -numericUnits }, $set: { updatedAt: new Date() } }
    );
    if (stockResult.matchedCount === 0) {
      return res.status(400).json({ success: false, message: 'Insufficient stock' });
    }
    // ---------- Step 2: create Sale document ----------
    const saleId = new mongoose.Types.ObjectId().toString();
    let saleDoc;
    try {
      saleDoc = await Sale.create({
        _id: saleId,
        productId,
        units: numericUnits,
        pricePerUnit: salePrice,
        date: saleDate,
        createdAt: new Date(),
      });
    } catch (e) {
      // Compensation: restore stock
      await Inventory.updateOne({ _id: productId }, { $inc: { stockLevel: numericUnits } });
      console.error('Error creating Sale, stock restored:', e);
      return res.status(500).json({ success: false, message: 'Failed to record sale' });
    }
    // ---------- Step 3: upsert SalesDaily ----------
    const dailyId = `${productId}_${saleDate.toISOString().slice(0, 10)}`;
    try {
      await SalesDaily.updateOne(
        { _id: dailyId },
        {
          $set: {
            productId,
            date: saleDate,
            lastUnitPrice: salePrice,
            updatedAt: new Date(),
          },
          $inc: { units: numericUnits },
        },
        { upsert: true }
      );
    } catch (e) {
      // Compensation: delete Sale and restore stock
      await Sale.deleteOne({ _id: saleId });
      await Inventory.updateOne({ _id: productId }, { $inc: { stockLevel: numericUnits } });
      console.error('Error upserting SalesDaily, compensation performed:', e);
      return res.status(500).json({ success: false, message: 'Failed to update daily aggregates' });
    }
    // ---------- Fetch updated docs for response ----------
    const updatedInventory = await Inventory.findById(productId);
    const updatedDaily = await SalesDaily.findById(dailyId);
    return res.status(201).json({
      success: true,
      message: 'Sale recorded successfully',
      sale: saleDoc,
      inventory: updatedInventory,
      salesDaily: updatedDaily,
    });
  } catch (err) {
    console.error('Unexpected error in createSale:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
