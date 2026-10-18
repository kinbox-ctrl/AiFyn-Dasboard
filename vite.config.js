import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    // `npm run dev` proxies /api to `npm run dev:api` (wrangler on 8788, sharing the site's local D1).
    proxy: { "/api": "http://127.0.0.1:8788" },
  },
});
