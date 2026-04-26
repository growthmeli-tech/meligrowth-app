import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
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
