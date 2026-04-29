const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../config/.env"), override: false });

const { cloudinary } = require("../config/cloudinary");

const BACKEND_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(BACKEND_ROOT, "../..");
const SOURCE_DIR = path.resolve(REPO_ROOT, "yenkasa-web/public/images");
const FRONTEND_MANIFEST_PATH = path.resolve(
  REPO_ROOT,
  "yenkasa-web/src/config/cloudinaryStaticAssets.js"
);
const BACKEND_MANIFEST_PATH = path.resolve(
  BACKEND_ROOT,
  "public/images/cloudinary-static-assets.json"
);

const CLOUDINARY_FOLDER = process.env.CLOUDINARY_STATIC_ASSETS_FOLDER || "yenkasa/web/static";

const ASSETS = [
  { key: "logo.png", file: "logo.png", publicId: "logo" },
  { key: "ykc.png", file: "ykc.png", publicId: "ykc" },
  { key: "verified.png", file: "verified.png", publicId: "verified" },
  { key: "admin.png", file: "admin.png", publicId: "admin" },
  { key: "moderator.png", file: "moderator.png", publicId: "moderator" },
  { key: "app-icon.png", file: "app-icon.png", publicId: "app-icon" },
  { key: "default.png", file: "default.png", publicId: "default" },
];

function assertCloudinaryConfig() {
  const required = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length) {
    throw new Error(
      `Missing Cloudinary environment variables: ${missing.join(", ")}`
    );
  }
}

function assertSourceFiles() {
  const missing = ASSETS
    .map((asset) => path.join(SOURCE_DIR, asset.file))
    .filter((filePath) => !fs.existsSync(filePath));

  if (missing.length) {
    throw new Error(
      `Missing static asset files:\n${missing.map((filePath) => `- ${filePath}`).join("\n")}`
    );
  }
}

function writeManifest(urls) {
  const frontendSource = `export const CLOUDINARY_STATIC_IMAGES = ${JSON.stringify(
    urls,
    null,
    2
  )};\n\nexport default CLOUDINARY_STATIC_IMAGES;\n`;

  fs.mkdirSync(path.dirname(FRONTEND_MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(FRONTEND_MANIFEST_PATH, frontendSource, "utf8");

  fs.mkdirSync(path.dirname(BACKEND_MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(BACKEND_MANIFEST_PATH, `${JSON.stringify(urls, null, 2)}\n`, "utf8");
}

async function uploadAsset(asset) {
  const filePath = path.join(SOURCE_DIR, asset.file);
  const result = await cloudinary.uploader.upload(filePath, {
    folder: CLOUDINARY_FOLDER,
    public_id: asset.publicId,
    overwrite: true,
    invalidate: true,
    resource_type: "image",
    unique_filename: false,
  });

  return [asset.key, result.secure_url];
}

async function main() {
  assertCloudinaryConfig();
  assertSourceFiles();

  console.log(`Uploading ${ASSETS.length} Yenkasa static assets to ${CLOUDINARY_FOLDER}...`);
  const entries = [];

  for (const asset of ASSETS) {
    const [key, url] = await uploadAsset(asset);
    entries.push([key, url]);
    console.log(`Uploaded ${key}`);
  }

  const urls = Object.fromEntries(entries);
  writeManifest(urls);
  console.log(`Wrote frontend manifest: ${FRONTEND_MANIFEST_PATH}`);
  console.log(`Wrote backend manifest: ${BACKEND_MANIFEST_PATH}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
