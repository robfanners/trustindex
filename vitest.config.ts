import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        "src/app/**",        // Next.js pages/routes — tested via E2E, not unit
        "src/components/**", // React components — tested via E2E
        "**/*.d.ts",
        "vitest.config.ts",
        "vitest.setup.ts",
      ],
      thresholds: {
        lines: 30,
        functions: 30,
        branches: 25,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `ethers` is an optional runtime dependency loaded dynamically in
      // src/lib/prove/chain.ts. It is not installed in node_modules because
      // chain-anchoring is opt-in. Tests always mock @/lib/prove/chain, but
      // vite still statically analyses the import — stub it so resolution
      // succeeds under vitest.
      ethers: path.resolve(__dirname, "./src/lib/__tests__/ethers-stub.ts"),
    },
  },
});
