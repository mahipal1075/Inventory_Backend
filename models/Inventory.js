const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Firestore document ID
  productName: { type: String },
  name: { type: String },
  sku: { type: String },
  expiryDate: { type: Date },
  brand: { type: String },
  category: { type: String },
  subCategory: { type: String },
  quantity: { type: Number },
  unitOfMeasure: { type: String },
  description: { type: String },
  price: { type: Number },
  cost: { type: Number },
  sellingPrice: { type: Number },
  status: { type: String },
  patternType: { type: String },
  stockLevel: { type: Number },
  qrCode: { type: String },
  qrPayload: { type: String },
  createdAt: { type: Date },
  updatedAt: { type: Date }
});

// Indexes – SKU if present, and category for filtering
InventorySchema.index({ sku: 1 });
InventorySchema.index({ category: 1 });

module.exports = mongoose.model('Inventory', InventorySchema);
