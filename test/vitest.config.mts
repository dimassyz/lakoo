import { defineConfig } from "vitest/config";

/**
 * Config suite QA di `test/` (T-11).
 *
 * Root `vitest.config.mts` belum memasukkan `test/**` ke `include`, jadi suite
 * ini dijalankan terpisah sampai tech-lead menyetujui perubahan config root:
 *
 *   npx vitest run --config test/vitest.config.mts
 *
 * Catatan: file ini TIDAK mengubah config root — permintaan perubahan root
 * (satu baris `include`) dicatat di `test/TEST_PLAN.md` §9 untuk tech-lead.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
