import type { NextConfig } from "next";

// Header keamanan sesuai SPEC §8.6 (beku bersama SPEC v1.0).
// Nonce CSP untuk script-src = usulan tech-lead bila kelak diperlukan.
const contentSecurityPolicy = [
  "default-src 'self'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

// SPEC §8.6 + docs/SECURITY.md Findings 1-2 (LOW, wajib ditutup):
// Permissions-Policy di semua rute; X-Robots-Tag di rute non-publik
// (defense-in-depth indexing, robots.txt saja tidak cukup).
const noindexRoutes = [
  "/toko/:path*",
  "/masuk",
  "/daftar",
  "/mulai",
  "/api/:path*",
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      ...noindexRoutes.map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
    ];
  },
};

export default nextConfig;
