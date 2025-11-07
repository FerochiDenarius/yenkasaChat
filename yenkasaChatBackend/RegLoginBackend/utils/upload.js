const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, file.fieldname + "-" + Date.now() + path.extname(file.originalname))
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/", "video/", "audio/"];
  if (allowed.some((type) => file.mimetype.startsWith(type))) cb(null, true);
  else cb(new Error("Unsupported file type"), false);
};

// ✅ Return a function so router.post always gets a function
function uploadFiles() {
  return multer({ storage, fileFilter }).fields([
    { name: "imageUrl", maxCount: 1 },
    { name: "videoUrl", maxCount: 1 },
    { name: "audioUrl", maxCount: 1 },
    { name: "media", maxCount: 1 },
  ]);
}

module.exports = uploadFiles;
