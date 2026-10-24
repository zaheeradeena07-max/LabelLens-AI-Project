const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomBytes } = require("node:crypto");
const User = require("../models/userModel");

const allowedAllergens = ["Peanuts", "Tree nuts", "Milk/dairy", "Eggs", "Soy", "Wheat", "Gluten", "Sesame", "Fish", "Shellfish"];
const allowedPreferences = ["Vegetarian", "Vegan", "Lactose-free", "Gluten-free"];
const profileFields = ["allergens", "otherAllergens", "dietaryPreferences", "customRestrictions", "avoidIngredients", "notes"];

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, dietaryProfile: user.dietaryProfile || {} };
}

function setSession(res, user) {
  const csrfToken = randomBytes(32).toString("hex");
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET must be configured with at least 32 characters");
  const token = jwt.sign({ id: user._id.toString(), csrf: csrfToken }, secret, { expiresIn: "1h" });
  const secure = process.env.NODE_ENV === "production";
  const sameSite = secure ? (process.env.COOKIE_SAME_SITE || "none") : "lax";
  res.cookie("labelLensSession", token, {
    httpOnly: true, secure, sameSite, path: "/api", maxAge: 60 * 60 * 1000,
  });
  return csrfToken;
}

function cleanList(value, label) {
  if (!Array.isArray(value) || value.length > 30 || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be a list of up to 30 text values`);
  }
  const values = [...new Set(value.map((item) => item.trim()).filter(Boolean))];
  if (values.some((item) => item.length > 100)) throw new Error(`${label} entries must be 100 characters or fewer`);
  return values;
}

function cleanProfile(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).some((key) => !profileFields.includes(key))) {
    throw new Error("Invalid dietary profile");
  }
  const profile = {
    allergens: cleanList(input.allergens ?? [], "Allergens"),
    otherAllergens: cleanList(input.otherAllergens ?? [], "Other allergens"),
    dietaryPreferences: cleanList(input.dietaryPreferences ?? [], "Dietary preferences"),
    customRestrictions: cleanList(input.customRestrictions ?? [], "Restrictions"),
    avoidIngredients: cleanList(input.avoidIngredients ?? [], "Ingredients to avoid"),
    notes: input.notes ?? "",
  };
  if (profile.allergens.some((item) => !allowedAllergens.includes(item)) ||
      profile.dietaryPreferences.some((item) => !allowedPreferences.includes(item)) ||
      typeof profile.notes !== "string" || profile.notes.length > 1000) {
    throw new Error("One or more dietary profile values are invalid");
  }
  return profile;
}

function handleError(res) {
  return res.status(503).json({ msg: "Account service is temporarily unavailable. Check the database connection." });
}

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (typeof name !== "string" || !name.trim() || name.trim().length > 100 ||
        typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        typeof password !== "string" || password.length < 8 || password.length > 72) {
      return res.status(400).json({ msg: "Enter a name, valid email, and password of 8–72 characters" });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (await User.findOne({ email: normalizedEmail })) return res.status(409).json({ msg: "An account with this email already exists" });
    const user = new User({
      name: name.trim(), email: normalizedEmail,
      password: await bcrypt.hash(password, 12), dietaryProfile: {},
    });
    await user.save();
    const csrfToken = setSession(res, user);
    return res.status(201).json({ user: publicUser(user), csrfToken });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ msg: "An account with this email already exists" });
    if (error.name === "ValidationError") return res.status(400).json({ msg: "Invalid account details" });
    return handleError(res);
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        typeof password !== "string" || password.length > 72) {
      return res.status(400).json({ msg: "Enter a valid email and password" });
    }
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ msg: "Invalid email or password" });
    const csrfToken = setSession(res, user);
    return res.json({ user: publicUser(user), csrfToken });
  } catch (error) {
    return handleError(res);
  }
};

exports.logout = (req, res) => {
  res.clearCookie("labelLensSession", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: process.env.NODE_ENV === "production" ? (process.env.COOKIE_SAME_SITE || "none") : "lax", path: "/api" });
  return res.json({ msg: "Logged out" });
};

exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ msg: "Account no longer exists" });
    return res.json({ user: publicUser(user), csrfToken: req.user.csrf });
  } catch (error) { return handleError(res); }
};

exports.updateProfile = async (req, res) => {
  let profile;
  try { profile = cleanProfile(req.body); }
  catch (error) { return res.status(400).json({ msg: error.message }); }
  try {
    const user = await User.findByIdAndUpdate(req.user.id, { $set: { dietaryProfile: profile } }, { new: true, runValidators: true });
    if (!user) return res.status(401).json({ msg: "Account no longer exists" });
    return res.json({ user: publicUser(user) });
  } catch (error) { return handleError(res); }
};
