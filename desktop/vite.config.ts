import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const host = process.env.TAURI_DEV_HOST;
const mockTauri = process.env.VITE_MOCK_TAURI === "true";

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [tailwindcss(), react()],

  resolve: mockTauri
    ? {
        alias: {
          "@tauri-apps/api/core": path.resolve(
            __dirname,
            "src/mocks/tauri/core.ts",
          ),
          "@tauri-apps/api/event": path.resolve(
            __dirname,
            "src/mocks/tauri/event.ts",
          ),
          "@tauri-apps/api/window": path.resolve(
            __dirname,
            "src/mocks/tauri/window.ts",
          ),
        },
      }
    : undefined,

  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
