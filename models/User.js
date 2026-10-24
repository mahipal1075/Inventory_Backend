const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  username: { type: String },
  sku: { type: String },
  description: { type: String },
  stockLevel: { type: Number },
  expiryDate: { type: Date },
  brand: { type: String },
  category: { type: String },
  quantity: { type: Number },
  unitOfMeasure: { type: String },
  price: { type: Number },
  additionalInfo: { type: String }
});

// Index on username for potential lookups
UserSchema.index({ username: 1 });

module.exports = mongoose.model('User', UserSchema);
