const mongoose = require("mongoose");

const foodSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true },
  protein: { type: Number, required: true, min: 0 },
  calories: { type: Number, required: true, min: 0 },
}, { timestamps: true });

module.exports = mongoose.model("Food", foodSchema);
