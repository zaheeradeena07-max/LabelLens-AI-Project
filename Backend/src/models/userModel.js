const mongoose = require("mongoose");

const dietaryProfileSchema = new mongoose.Schema({
  allergens: { type: [String], default: [] },
  otherAllergens: { type: [String], default: [] },
  dietaryPreferences: { type: [String], default: [] },
  customRestrictions: { type: [String], default: [] },
  avoidIngredients: { type: [String], default: [] },
  notes: { type: String, default: "", maxlength: 1000 },
}, { _id: false });

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },

    password: {
      type: String,
      required: true,
      minlength: 8,
    },

    allergies: {
      type: [String],
      default: [],
    },

    goals: {
      type: String,
      default: "",
    },
    dietaryProfile: { type: dietaryProfileSchema, default: () => ({}) },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
