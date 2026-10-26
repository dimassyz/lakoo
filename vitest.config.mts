import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Serial: tiap file test membawa instance PGlite; paralel = CPU contention
    // yang mengkontaminasi pengukuran waktu dinding (perf test §4.2 ≤300 ms).
    // Ambang & best-of-3 TIDAK berubah — lingkungannya yang dibuat deterministik.
    // Keputusan tech-lead, CODE_STANDARDS §5.
    fileParallelism: false,
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "backend/**/*.{test,spec}.{ts,tsx}",
      "database/**/*.{test,spec}.{ts,tsx}",
      "test/**/*.{test,spec}.{ts,tsx}",
    ],
  },
});
