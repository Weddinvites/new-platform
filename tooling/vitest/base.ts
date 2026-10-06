import { defineConfig } from "vitest/config";

export const baseConfig = defineConfig({
  test: {
    environment: "node",
    passWithNoTests: true,
    globals: false,
    reporters: ["default"],
  },
});
