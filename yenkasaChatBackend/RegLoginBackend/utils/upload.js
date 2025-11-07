const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ✅ Create a temporary uploads folder if it doesn't exist
const tempDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// ✅ Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir); // store in /uploads
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    cb(null, `${Date.now()}-${baseName}${ext}`);
  },
});

// ✅ Allow images, videos, and audio
const fileFilter = (req, file, cb) => {
  const allowed = ["image/", "video/", "audio/"];
  if (allowed.some(prefix => file.mimetype.startsWith(prefix))) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type"), false);
  }
};

// ✅ Export configured multer instance
const upload = multer({ storage, fileFilter });

module.exports = upload;
