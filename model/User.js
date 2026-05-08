const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, default: null },
  phone: { type: String, required: true },
  cnic: { type: String, required: true, unique: true },
  address: { type: String, required: true },
  isVerified: { type: String, default: "requested" },
  profileImage: { type: String, default: null },
  frontCnic: { type: String, default: null },
  backCnic: { type: String, default: null },
  role: { type: String, default: "user" },
  isDeleted: { type: Boolean, required: true, default: false },
  createdAt: { type: Date, default: Date.now }
});
  
  module.exports = mongoose.model("User", userSchema);