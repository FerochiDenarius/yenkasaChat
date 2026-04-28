import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/web/",
  plugins: [react()],
  build: {
    outDir: "../yenkasaChatBackend/RegLoginBackend/public/yenkasa_web",
    emptyOutDir: true
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/triciabales-api": {
        target: "https://www.yenkasa.xyz",
        changeOrigin: true,
        secure: true
      }
    }
  }
});
