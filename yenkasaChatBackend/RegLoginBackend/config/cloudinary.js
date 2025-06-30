// config/cloudinary.js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log("Cloudinary ENV Check:");
console.log("cloud_name:", process.env.CLOUDINARY_CLOUD_NAME);
console.log("api_key:", process.env.CLOUDINARY_API_KEY);
console.log("api_secret:", process.env.CLOUDINARY_API_SECRET ? "✅ present" : "❌ missing");


const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'yenkasa-profile-pictures',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    public_id: (req, file) => `${req.user.id}-${Date.now()}`
  }
});

module.exports = { cloudinary, storage };
