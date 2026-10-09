import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
export default defineConfig({
  plugins: [vue()],
  server: { proxy: { "/api": "http://127.0.0.1:8000" } }, // npm run web:dev → API на :8000
  build: { outDir: "../public/app", emptyOutDir: true },
});
