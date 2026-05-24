import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "../yenkasaChatBackend/RegLoginBackend/public/yenkasa_ai",
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5174,
  },
});
