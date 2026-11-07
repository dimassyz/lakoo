import type { AppProps } from "next/app";
import "@/styles/globals.css";

/** Pages Router: _app wajib ada agar CSS global punya entry. */
export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className="font-sans">
      <Component {...pageProps} />
    </div>
  );
}
