import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Forward browser API requests to the Express server during local development.
    // Without this proxy, /api/auth/login and /api/auth/register hit Vite's
    // index.html fallback instead of the backend, so account access cannot work.
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
