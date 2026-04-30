import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
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
      "@": new URL("./", import.meta.url).pathname,
      "server-only": path.join(root, "tests/mocks/server-only-stub.ts")
    }
  }
});
