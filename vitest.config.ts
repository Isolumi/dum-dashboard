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
            },
          }),
          {},
        ),
        // Component tests (.tsx): use jsdom environment, no TanStack Start plugin
        defineProject({
          plugins: [tsconfigPaths({ projects: ["./tsconfig.json"] })],
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
