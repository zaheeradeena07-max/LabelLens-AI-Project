
const express = require("express");
const multer = require("multer");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const router = express.Router();

// OCR library (Tesseract as example)
const Tesseract = require("tesseract.js");

const projectRoot = path.resolve(__dirname, "../..");
const uploadDirectory = path.join(projectRoot, "uploads");
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

    // Log file info
    console.log("Upload route hit:", req.file);

    const relativePath = path
      .relative(projectRoot, req.file.path)
      .split(path.sep)
      .join("/");

    try {
      // Run OCR on uploaded image
      const result = await Tesseract.recognize(req.file.path, "eng");
      const extractedText = result.data.text.trim();
      const confidence = result.data.confidence || 0;

      // Log OCR output
      console.log("OCR extracted text:", extractedText);
      console.log("OCR confidence:", confidence);

      // Confidence check
      if (!extractedText || confidence < 70) {
        return res.json({
          status: "uncertain",
          message:
            "Label unclear. Please upload a clearer image or confirm manually.",
          extractedText: extractedText || "",
        });
      }

      // Success response
      res.json({
        status: "success",
        message: "File uploaded and OCR processed successfully",
        file: {
          filename: req.file.filename,
          path: relativePath,
          mimetype: req.file.mimetype,
          size: req.file.size,
        },
        extractedText,
      });
    } catch (err) {
      return res
        .status(500)
        .json({ error: "OCR processing failed", details: err.message });
    }
  }
);

module.exports = router;
