import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin";

const DEFAULT_PORT = 4173;
const DEFAULT_BASE_PATH = "/";

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

export default defineConfig({
  base: basePath,
  plugins: [mockupPreviewPlugin(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    strictPort: true,
    allowedHosts: true,
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
