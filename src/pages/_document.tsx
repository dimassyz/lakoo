import { Head, Html, Main, NextScript } from "next/document";

/** SPEC §7b — `lang="id"` untuk seluruh halaman. */
export default function Document() {
  return (
    <Html lang="id">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
