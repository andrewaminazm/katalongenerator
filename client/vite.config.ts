import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy is only needed in local dev. In production (Netlify) the
    // netlify.toml [[redirects]] rule routes /api/* to the serverless function.
    ...(command === "serve"
      ? {
          proxy: {
            "/api": {
              target: "http://127.0.0.1:8787",
              changeOrigin: true,
            },
          },
        }
      : {}),
  },
}));
