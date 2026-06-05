/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/harvard-handouts": {
        target:
          "https://people.math.harvard.edu/~knill/teaching/math1a2024/handouts",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/harvard-handouts/, ""),
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
