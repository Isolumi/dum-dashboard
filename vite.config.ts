import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import { devtools } from "@tanstack/devtools-vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const config = defineConfig(({ mode }) => ({
  envPrefix: ["VITE_"],
  plugins: [
    ...(mode === "development" ? [devtools()] : []),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      router: {
        routeFileIgnorePattern: "\\.functions\\.ts$",
      },
    }),
    nitro({ preset: "node-server", serverDir: true }),
    viteReact(),
  ],
}));

export default config;
