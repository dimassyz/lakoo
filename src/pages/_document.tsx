import { Head, Html, Main, NextScript } from "next/document";

/** SPEC §7b — `lang="id"` untuk seluruh halaman. */
export default function Document() {
  return (
    <Html lang="id">
      <Head>
        {/* DESIGN.md v2.0 §3 — Plus Jakarta Sans, satu font untuk seluruh app,
            dimuat lewat <link> di sini. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
