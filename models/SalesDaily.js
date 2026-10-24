const mongoose = require('mongoose');

const SalesDailySchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. "<productId>_YYYY-MM-DD"
  productId: { type: String, required: true },
  date: { type: Date },
  units: { type: Number },
  lastUnitPrice: { type: Number },
  updatedAt: { type: Date }
}, { strict: false }); // keep any extra fields if present

// Indexes for forecasting queries
SalesDailySchema.index({ productId: 1 });
SalesDailySchema.index({ date: 1 });
SalesDailySchema.index({ productId: 1, date: 1 });

module.exports = mongoose.model('SalesDaily', SalesDailySchema);
