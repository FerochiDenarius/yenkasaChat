// config/cloudinary.js
const cloudinarySdk = require('cloudinary');
const cloudinaryStorage = require('multer-storage-cloudinary');
const cloudinary = cloudinarySdk.v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = cloudinaryStorage({
  cloudinary: cloudinarySdk,
  folder: 'yenkasa/profile',
  allowedFormats: ['jpg', 'jpeg', 'png'],
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`);
  },
  transformation: [
    { width: 400, height: 400, crop: "fill", gravity: "face" },
    { quality: "auto:good" }
  ]
});

module.exports = { cloudinary, storage };
