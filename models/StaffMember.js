const mongoose = require('mongoose');

const StaffMemberSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  name: { type: String },
  email: { type: String },
  phone: { type: String },
  password: { type: String },
  role: { type: String },
  status: { type: String }
});

// Optional index for email lookup
StaffMemberSchema.index({ email: 1 });

module.exports = mongoose.model('StaffMember', StaffMemberSchema);
