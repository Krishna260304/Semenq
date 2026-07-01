import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const DEFAULT_PORT = 5173;
const DEFAULT_BASE_PATH = "/";
const DEFAULT_API_ORIGIN = "http://127.0.0.1:3000";

function resolvePort(rawPort: string | undefined, fallback: number): number {
  if (!rawPort) {
    return fallback;
  }

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  return port;
}

function resolveBasePath(rawBasePath: string | undefined): string {
  const basePath = rawBasePath?.trim() || DEFAULT_BASE_PATH;

  if (!basePath.startsWith("/")) {
    throw new Error(
      `Invalid BASE_PATH value: "${rawBasePath}". BASE_PATH must start with "/".`,
    );
  }

  return basePath.endsWith("/") ? basePath : `${basePath}/`;
}

const port = resolvePort(process.env.PORT, DEFAULT_PORT);
const basePath = resolveBasePath(process.env.BASE_PATH);
const apiOrigin = process.env.API_ORIGIN?.trim() || DEFAULT_API_ORIGIN;

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: apiOrigin,
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
