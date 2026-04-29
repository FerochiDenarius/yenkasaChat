import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function rootImagesPlugin() {
  return {
    name: "root-images",
    configureServer(server) {
      const imagesDir = path.resolve(__dirname, "public/images");

      server.middlewares.use("/images", (req, res, next) => {
        const rawName = decodeURIComponent((req.url || "").replace(/^\/+/, ""));
        const fileName = path.basename(rawName);
        const filePath = path.join(imagesDir, fileName);

        if (!fileName || !filePath.startsWith(imagesDir)) {
          next();
          return;
        }

        fs.readFile(filePath, (error, data) => {
          if (error) {
            next();
            return;
          }

          const ext = path.extname(fileName).toLowerCase();
          const contentType =
            ext === ".svg"
              ? "image/svg+xml"
              : ext === ".webp"
                ? "image/webp"
                : ext === ".jpg" || ext === ".jpeg"
                  ? "image/jpeg"
                  : "image/png";

          res.setHeader("Content-Type", contentType);
          res.end(data);
        });
      });
    },
  };
}

export default defineConfig({
  base: "/web/",
  plugins: [react(), rootImagesPlugin()],
  build: {
    outDir: "../yenkasaChatBackend/RegLoginBackend/public/yenkasa_web",
    emptyOutDir: true
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: "https://www.yenkasa.xyz",
        changeOrigin: true,
        secure: false
      }
    }
  }
});
