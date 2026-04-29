import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
    environmentMatchGlobs: [["tests/**/*.test.tsx", "jsdom"]],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["lib/**", "app/**/actions.ts", "app/api/**"],
      exclude: [
        "node_modules/",
        "tests/",
        "**/*.config.*",
        "**/supabase/migrations/**",
        "**/services/**",
        "**/*.d.ts"
      ],
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 65
      }
    }
  },
  resolve: {
    alias: {
      "@": new URL("./", import.meta.url).pathname
    }
  }
});
