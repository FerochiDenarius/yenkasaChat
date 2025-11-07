// utils/upload.js
const multer = require("multer");
const path = require("path");

// ✅ Define storage (temporary before Cloudinary)
const storage = multer.diskStorage({
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${file.fieldname}${ext}`);
  },
});

// ✅ Allow images, videos, and audio only
const fileFilter = (req, file, cb) => {
  const allowed = ["image/", "video/", "audio/"];
  if (allowed.some(prefix => file.mimetype.startsWith(prefix))) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type"), false);
  }
};

// ✅ Export the multer instance
const upload = multer({ storage, fileFilter });
module.exports = upload;
