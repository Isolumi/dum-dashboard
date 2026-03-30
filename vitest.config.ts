import viteReact from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineProject, mergeConfig } from "vitest/config";
import { defineConfig } from "vitest/config";

const base = defineConfig({
  plugins: [tsconfigPaths({ projects: ["./tsconfig.json"] })],
  test: {
    exclude: [
      "**/node_modules/**",
      ".claude/worktrees/**",
    ],
  },
});

export default mergeConfig(
  base,
  defineConfig({
    test: {
      projects: [
        // Unit tests (.ts): use TanStack Start plugin for createServerFn transform
        mergeConfig(
          defineProject({
            plugins: [
              tsconfigPaths({ projects: ["./tsconfig.json"] }),
              tanstackStart(),
            ],
            test: {
              name: "unit",
              include: ["src/**/-*.test.ts"],
              environment: "node",
              env: {
                VITE_SUPABASE_URL: "http://localhost",
                VITE_SUPABASE_PUBLISHABLE_KEY: "test",
              },
            },
          }),
          {},
        ),
        // Component tests (.tsx): use jsdom environment, no TanStack Start plugin
        defineProject({
          plugins: [tsconfigPaths({ projects: ["./tsconfig.json"] }), viteReact()],
          test: {
            name: "components",
            include: ["src/**/-*.test.tsx"],
            environment: "jsdom",
          },
        }),
      ],
    },
  }),
);
