const express = require("express");
const router = express.Router();
const Food = require("../models/foodModel");

// Get all foods
router.get("/", async (req, res) => {
  try {
    const foods = await Food.find();
    res.json(foods);
  } catch (err) {
    res.status(500).json({ msg: "Unable to retrieve recommendations" });
  }
});

// High protein foods
router.get("/high-protein", async (req, res) => {
  try {
    const foods = await Food.find({ protein: { $gte: 10 } });
    res.json(foods);
  } catch (err) {
    res.status(500).json({ msg: "Unable to retrieve recommendations" });
  }
});

// Low calorie foods
router.get("/low-calorie", async (req, res) => {
  try {
    const foods = await Food.find({ calories: { $lte: 100 } });
    res.json(foods);
  } catch (err) {
    res.status(500).json({ msg: "Unable to retrieve recommendations" });
  }
});

// By category
router.get("/category/:cat", async (req, res) => {
  try {
    const foods = await Food.find({ category: req.params.cat });
    res.json(foods);
  } catch (err) {
    res.status(500).json({ msg: "Unable to retrieve recommendations" });
  }
});

module.exports = router;
