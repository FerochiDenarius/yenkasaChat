const multer = require("multer");
const path = require("path");

// ==========================
// STORAGE (local disk)
// ==========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    )
});

// ==========================
// FILE FILTER
// ==========================
const fileFilter = (req, file, cb) => {
  const allowed = ["image/", "video/", "audio/"];
  if (allowed.some((type) => file.mimetype.startsWith(type))) cb(null, true);
  else cb(new Error("Unsupported file type"), false);
};

// ==========================
// EXPORT 1: uploadFiles() → for posts (fields)
// ==========================
function uploadFiles() {
  return multer({ storage, fileFilter }).fields([
    { name: "imageUrl", maxCount: 1 },
    { name: "videoUrl", maxCount: 1 },
    { name: "audioUrl", maxCount: 1 },
    { name: "media", maxCount: 1 },
  ]);
}

// ==========================
// EXPORT 2: profileImageUpload → for profile pictures (single)
// ==========================
const profileImageUpload = multer({
  storage,
  fileFilter
}).single("profileImage");

// ==========================
// EXPORT BOTH
// ==========================
module.exports = {
  uploadFiles,
  profileImageUpload
};
