import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/global-setup.ts"],
    // Semua file test berbagi satu database SQLite → jalankan berurutan.
    fileParallelism: false,
    env: {
      DATABASE_URL: "file:./test.db",
      ADMIN_EMAIL: "admin@example.test",
      ADMIN_PASSWORD: "test-password",
      TEST_NOW: "",
    },
  },
});
