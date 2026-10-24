// backend/controllers/inventoryController.js

const Inventory = require('../models/Inventory');

// @desc    Get all inventory items
// @route   GET /api/inventory
// @access  Public
exports.getAllInventory = async (req, res) => {
  try {
    const items = await Inventory.find();
    return res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (err) {
    console.error('Error fetching inventory:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get single inventory item by ID
// @route   GET /api/inventory/:id
// @access  Public
exports.getInventoryById = async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }
    return res.status(200).json({ success: true, data: item });
  } catch (err) {
    console.error('Error fetching inventory by ID:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Create new inventory item
// @route   POST /api/inventory
// @access  Public
exports.createInventory = async (req, res) => {
  try {
    const { _id } = req.body;
    if (_id) {
      const existing = await Inventory.findById(_id);
      if (existing) {
        return res.status(409).json({ success: false, message: 'Inventory item with this _id already exists' });
      }
    }
    const newItem = new Inventory(req.body);
    await newItem.save();
    return res.status(201).json({
      success: true,
      message: 'Inventory item created successfully',
      data: newItem,
    });
  } catch (err) {
    console.error('Error creating inventory item:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update inventory item
// @route   PUT /api/inventory/:id
// @access  Public
exports.updateInventory = async (req, res) => {
  try {
    // Prevent _id change
    if (req.body._id) delete req.body._id;
    const updated = await Inventory.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }
    return res.status(200).json({
      success: true,
      message: 'Inventory item updated successfully',
      data: updated,
    });
  } catch (err) {
    console.error('Error updating inventory item:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete inventory item
// @route   DELETE /api/inventory/:id
// @access  Public
exports.deleteInventory = async (req, res) => {
  try {
    const deleted = await Inventory.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }
    return res.status(200).json({
      success: true,
      message: 'Inventory item deleted successfully',
    });
  } catch (err) {
    console.error('Error deleting inventory item:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
