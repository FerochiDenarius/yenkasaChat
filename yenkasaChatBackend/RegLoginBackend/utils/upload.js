const multer = require("multer");
const storage = multer.memoryStorage();

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
    { name: "imageUrl", maxCount: 10 },
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
// EXPORT 3: uploadAdFiles() -> sponsored ads
// ==========================
function uploadAdFiles() {
  return multer({ storage, fileFilter }).fields([
    { name: "image", maxCount: 1 },
    { name: "imageUrl", maxCount: 1 },
    { name: "video", maxCount: 1 },
    { name: "videoUrl", maxCount: 1 },
    { name: "media", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
    { name: "customThumbnail", maxCount: 1 }
  ]);
}

// ==========================
// EXPORT BOTH
// ==========================
module.exports = {
  uploadFiles,
  profileImageUpload,
  uploadAdFiles
};
