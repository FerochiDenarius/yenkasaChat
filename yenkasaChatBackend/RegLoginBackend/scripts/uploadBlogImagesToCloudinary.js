const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../config/.env"), override: false });

const { cloudinary } = require("../config/cloudinary");

const BACKEND_ROOT = path.resolve(__dirname, "..");
const BLOG_ROOT = path.join(BACKEND_ROOT, "public/blog");
const IMAGE_DIR = path.join(BLOG_ROOT, "images");
const MANIFEST_PATH = path.join(BLOG_ROOT, "cloudinary-blog-images.json");
const CLOUDINARY_FOLDER = process.env.CLOUDINARY_BLOG_IMAGES_FOLDER || "yenkasa/blog/images";
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const TEXT_EXTENSIONS = new Set([".html", ".css", ".js"]);

function assertCloudinaryConfig() {
  const required = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length) {
    throw new Error(`Missing Cloudinary environment variables: ${missing.join(", ")}`);
  }
}

function walkFiles(directory, predicate, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walkFiles(filePath, predicate, files);
    } else if (!predicate || predicate(filePath)) {
      files.push(filePath);
    }
  }
  return files;
}

function getImageFiles() {
  return walkFiles(IMAGE_DIR, (filePath) =>
    IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase())
  ).sort();
}

function getTextFiles() {
  return walkFiles(BLOG_ROOT, (filePath) =>
    TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase())
  ).sort();
}

function toDeliveryUrl(secureUrl) {
  return secureUrl.replace("/upload/", "/upload/f_auto,q_auto/");
}

function publicIdFor(filePath) {
  const relative = path.relative(IMAGE_DIR, filePath);
  const parsed = path.parse(relative);
  const normalizedDir = parsed.dir
    .split(path.sep)
    .filter(Boolean)
    .map((part) => part.replace(/[^a-zA-Z0-9_-]/g, "-"))
    .join("/");
  const normalizedName = parsed.name.replace(/[^a-zA-Z0-9_-]/g, "-");
  return [normalizedDir, normalizedName].filter(Boolean).join("/");
}

async function uploadImage(filePath) {
  const relativeName = path.relative(IMAGE_DIR, filePath).split(path.sep).join("/");
  const result = await cloudinary.uploader.upload(filePath, {
    folder: CLOUDINARY_FOLDER,
    public_id: publicIdFor(filePath),
    overwrite: true,
    invalidate: true,
    resource_type: "image",
    unique_filename: false,
  });

  return [relativeName, toDeliveryUrl(result.secure_url)];
}

function rewriteBlogReferences(urlsByFileName) {
  const textFiles = getTextFiles();
  let touched = 0;

  for (const filePath of textFiles) {
    let source = fs.readFileSync(filePath, "utf8");
    let next = source;

    for (const [fileName, cloudinaryUrl] of Object.entries(urlsByFileName)) {
      const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      next = next.replace(
        new RegExp(`(?:\\.\\./blog/images/|/blog/images/)${escaped}`, "g"),
        cloudinaryUrl
      );
    }

    if (next !== source) {
      fs.writeFileSync(filePath, next, "utf8");
      touched += 1;
    }
  }

  return touched;
}

async function main() {
  assertCloudinaryConfig();

  const imageFiles = getImageFiles();
  if (!imageFiles.length) {
    throw new Error(`No blog images found in ${IMAGE_DIR}`);
  }

  console.log(`Uploading ${imageFiles.length} blog images to ${CLOUDINARY_FOLDER}...`);
  const entries = [];

  for (const [index, filePath] of imageFiles.entries()) {
    const [fileName, url] = await uploadImage(filePath);
    entries.push([fileName, url]);
    console.log(`[${index + 1}/${imageFiles.length}] Uploaded ${fileName}`);
  }

  const urlsByFileName = Object.fromEntries(entries);
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(urlsByFileName, null, 2)}\n`, "utf8");

  const touched = rewriteBlogReferences(urlsByFileName);
  console.log(`Wrote manifest: ${MANIFEST_PATH}`);
  console.log(`Rewrote Cloudinary URLs in ${touched} blog files.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
