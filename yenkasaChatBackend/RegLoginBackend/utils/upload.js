const multer = require("multer");
const path = require("path");

// ✅ Store files temporarily before Cloudinary upload
const storage = multer.diskStorage({
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${file.fieldname}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    "image/",
    "video/",
    "audio/"
  ];
  if (allowed.some(prefix => file.mimetype.startsWith(prefix))) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type"), false);
  }
};

module.exports = multer({ storage, fileFilter });
