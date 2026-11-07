import { Head, Html, Main, NextScript } from "next/document";

/** SPEC §7b — `lang="id"` untuk seluruh halaman. */
export default function Document() {
  return (
    <Html lang="id">
      <Head>
        {/* DESIGN.md v2.0 §3 — Plus Jakarta Sans. Di-self-host lewat
            @font-face di tokens.css, BUKAN <link> Google Fonts: CSP
            next.config.ts (default-src 'self', nol font-src) memblokir
            stylesheet DAN berkas font dari domain Google, jadi <link> tidak
            pernah dimuat dan aplikasi jatuh ke system-ui tanpa error.
            Preconnect juga dihapus — preconnect tanpa resource yang dimuat
            adalah beban mati. */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
