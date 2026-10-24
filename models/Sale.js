const mongoose = require('mongoose');

const SaleSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Firestore document ID
  productId: { type: String, required: true }, // string reference, may be orphan
  units: { type: Number },
  pricePerUnit: { type: Number },
  date: { type: Date },
  createdAt: { type: Date }
}, { strict: false }); // allow extra fields from backup

// Indexes for querying
SaleSchema.index({ productId: 1 });
SaleSchema.index({ date: 1 });
SaleSchema.index({ productId: 1, date: 1 });

module.exports = mongoose.model('Sale', SaleSchema);
