import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { devtools } from "@tanstack/devtools-vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const config = defineConfig(({ mode }) => ({
  // VITE_* vars are inlined from .env.production at build time (public, committed to git).
  // SUPABASE_SECRET_KEY is NOT inlined — it stays as a runtime reference so workerd
  // can provide it from the Worker secret binding (set via `wrangler secret put`).
  envPrefix: ["VITE_"],
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    ...(mode === "development" ? [devtools()] : []),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      router: {
        routeFileIgnorePattern: "\\.functions\\.ts$",
      },
    }),
    viteReact(),
  ],
}));

export default config;
