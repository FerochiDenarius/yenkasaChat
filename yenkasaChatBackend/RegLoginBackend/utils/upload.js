const multer = require("multer");
const path = require("path");

// Storage setup (keep yours if it's customized)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

// File filter (optional safety check)
const fileFilter = (req, file, cb) => {
  const allowed = ["image/", "video/", "audio/"];
  if (allowed.some((type) => file.mimetype.startsWith(type))) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type"), false);
  }
};

// ✅ This line accepts imageUrl, videoUrl, or audioUrl
const upload = multer({ storage, fileFilter }).fields([
  { name: "imageUrl", maxCount: 1 },
  { name: "videoUrl", maxCount: 1 },
  { name: "audioUrl", maxCount: 1 },
  { name: "media", maxCount: 1 }, // keep for backward compatibility
]);

module.exports = upload;
