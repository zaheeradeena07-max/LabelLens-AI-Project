
const express = require("express");
const multer = require("multer");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const router = express.Router();
const User = require("../models/userModel");

// Tesseract is the existing OCR integration. Keep startup healthy if its
// optional runtime dependency has not been installed yet; report that clearly.
let Tesseract;
try { Tesseract = require("tesseract.js"); } catch { /* checked by the route */ }

const allergenTerms = {
  "Peanuts": ["peanut", "groundnut"],
  "Tree nuts": ["almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "macadamia", "tree nut"],
  "Milk/dairy": ["milk", "dairy", "whey", "casein", "lactose", "butter", "cream", "cheese", "yogurt", "yoghurt", "ghee"],
  "Eggs": ["egg", "albumin"], "Soy": ["soy", "soya"],
  "Wheat": ["wheat", "semolina"], "Gluten": ["gluten", "wheat", "barley", "rye", "malt"],
  "Sesame": ["sesame", "tahini"], "Fish": ["fish", "anchovy", "cod", "salmon"],
  "Shellfish": ["shellfish", "shrimp", "prawn", "crab", "lobster"],
};

function parseLabel(text, profile = {}) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const sectionStart = lines.findIndex((line) => /\bingredients?\b/i.test(line));
  let ingredientText = null;
  if (sectionStart >= 0) {
    const first = lines[sectionStart].replace(/^.*?\bingredients?\b\s*[:\-]?\s*/i, "");
    const collected = [first];
    for (const line of lines.slice(sectionStart + 1)) {
      if (/^(contains|may contain|allergen|nutrition|serving size|calories|warning|distributed by|manufactured)/i.test(line)) break;
      collected.push(line);
    }
    ingredientText = collected.join(" ").trim().slice(0, 1000) || null;
  }
  const ingredientList = ingredientText ? ingredientText.split(/[;,]/).map((item) => item.trim()).filter(Boolean) : [];
  const nutrition = {};
  const nutritionPattern = /\b(serving size|calories|total fat|saturated fat|trans fat|sodium|total carbohydrate|dietary fiber|total sugars|protein)\s*[:\-]?\s*(.*?)(?=\s+\b(?:serving size|calories|total fat|saturated fat|trans fat|sodium|total carbohydrate|dietary fiber|total sugars|protein)\s*[:\-]?\s*|$)/gi;
  for (const line of lines) {
    for (const match of line.matchAll(nutritionPattern)) {
      nutrition[match[1].toLowerCase()] = match[2].trim() || "visible, value unclear";
    }
  }
  const allergenLines = lines.filter((line) => /\b(contains|allergen|may contain)\b/i.test(line));
  const precautionaryStatements = allergenLines.filter((line) => /\bmay contain\b|\bmade in a facility\b|\bprocessed on shared\b/i.test(line));
  const declaredStatements = allergenLines.filter((line) => !precautionaryStatements.includes(line));
  const profileAllergens = [...(profile.allergens || []), ...(profile.otherAllergens || [])];
  const allergenMatches = [];
  for (const allergen of profileAllergens) {
    const knownTerms = allergenTerms[allergen] || [String(allergen).toLowerCase()];
    const terms = [...new Set(knownTerms)];
    const ingredientEvidence = terms.find((term) => (ingredientText || "").toLowerCase().includes(term.toLowerCase()));
    const declaredEvidence = terms.find((term) => declaredStatements.some((line) => line.toLowerCase().includes(term)));
    const precautionaryEvidence = terms.find((term) => precautionaryStatements.some((line) => line.toLowerCase().includes(term)));
    if (ingredientEvidence || declaredEvidence) allergenMatches.push({ allergen, status: "potential_match", evidence: ingredientEvidence || declaredEvidence, source: ingredientEvidence ? "ingredients" : "allergen_statement", note: "Verify the source label; OCR may misread small print." });
    else if (precautionaryEvidence) allergenMatches.push({ allergen, status: "precautionary_match", evidence: precautionaryEvidence, source: "may_contain_statement", note: "The label lists a precautionary statement, not an ingredient." });
  }
  const dietaryConflicts = [];
  const searchable = (ingredientText || "").toLowerCase();
  const checks = {
    "Vegan": ["milk", "whey", "casein", "egg", "honey", "gelatin", "meat", "fish"],
    "Vegetarian": ["gelatin", "rennet", "lard", "meat", "fish"],
    "Lactose-free": ["milk", "lactose", "whey", "cream"],
    "Gluten-free": ["wheat", "barley", "rye", "malt", "gluten"],
  };
  for (const preference of profile.dietaryPreferences || []) {
    const terms = checks[preference] || [];
    const matches = terms.filter((term) => searchable.includes(term));
    if (matches.length) dietaryConflicts.push({ preference, status: "potential_conflict", evidence: matches.join(", "), note: "A listed ingredient may conflict with this preference." });
    else dietaryConflicts.push({ preference, status: ingredientText ? "no_match_found_in_readable_text" : "unable_to_determine", evidence: ingredientText ? "No matching term found in the readable ingredients text." : "Ingredients could not be read." });
  }
  for (const restriction of [...(profile.customRestrictions || []), ...(profile.avoidIngredients || [])]) {
    const match = String(restriction).trim() && searchable.includes(String(restriction).toLowerCase());
    dietaryConflicts.push({ preference: restriction, status: match ? "potential_conflict" : ingredientText ? "no_match_found_in_readable_text" : "unable_to_determine", evidence: match ? String(restriction) : ingredientText ? "No matching term found in the readable ingredients text." : "Ingredients could not be read." });
  }
  const summary = allergenMatches.length ? "potential_allergen_match"
    : dietaryConflicts.some((item) => item.status === "potential_conflict") ? "dietary_preference_conflict"
      : ingredientText ? "no_matching_ingredient_detected_in_readable_text" : "unable_to_determine";
  return {
    productName: lines.find((line) => !/ingredients?|nutrition|calories|serving size|^(contains|may contain|allergen)/i.test(line)) || null,
    detectedIngredients: ingredientList,
    ingredientText,
    nutrition: { servingSize: nutrition["serving size"] || null, values: nutrition },
    allergenMatches,
    precautionaryStatements,
    dietaryConflicts,
    summary,
    limitations: ingredientText ? [] : ["Ingredients could not be read reliably; matching is incomplete."],
  };
}

const uploadDirectory = process.env.UPLOAD_DIR || path.join(os.tmpdir(), "labellens-uploads");
const supportedImages = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdir(uploadDirectory, { recursive: true }).then(
      () => cb(null, uploadDirectory),
      cb
    );
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (supportedImages[extension] !== file.mimetype) {
      return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
    }
    cb(null, true);
  },
});

// POST /api/upload
router.post(
  "/",
  (req, res, next) => {
    upload.single("image")(req, res, (error) => {
      if (!error) return next();
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "Image must be 5 MB or smaller" });
      }
      if (error instanceof multer.MulterError) {
        return res
          .status(400)
          .json({ error: "Expected one supported image in the image field" });
      }
      return next(error);
    });
  },
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    if (!Tesseract) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(503).json({ error: "OCR is not configured on this server. Install backend dependencies including tesseract.js." });
    }

    try {
      const cachePath = process.env.TESSERACT_CACHE_DIR || path.join(os.tmpdir(), "labellens-tesseract");
      await fs.mkdir(cachePath, { recursive: true });
      const ocrOptions = { cachePath };
      if (process.env.TESSERACT_LANG_PATH) ocrOptions.langPath = process.env.TESSERACT_LANG_PATH;
      const result = await Tesseract.recognize(req.file.path, "eng", ocrOptions);
      const extractedText = result.data.text.trim();
      const confidence = result.data.confidence || 0;

      const user = await User.findById(req.user.id).select("dietaryProfile");
      if (!user) return res.status(401).json({ error: "Account no longer exists" });
      const analysis = parseLabel(extractedText, user.dietaryProfile || {});
      if (!extractedText || confidence < 35) {
        return res.json({
          status: "uncertain",
          message: "Label text could not be read reliably. Try a clearer, closer image.",
          extractedText: extractedText || "",
          confidence,
          analysis,
        });
      }

      res.json({
        status: "success",
        message: "Label image processed with OCR. Verify results against the packaging.",
        file: { mimetype: req.file.mimetype, size: req.file.size },
        extractedText,
        confidence,
        analysis,
      });
    } catch (err) {
      return res.status(500).json({ error: "OCR processing failed. Please try another image." });
    } finally {
      await fs.unlink(req.file.path).catch(() => {});
    }
  }
);

module.exports = router;
module.exports.parseLabel = parseLabel;
