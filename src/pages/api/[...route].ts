import type { NextApiRequest, NextApiResponse } from "next";
import { createApp } from "../../../backend/src/http/app.ts";
import { ApiError, internalError } from "../../../backend/src/http/errors.ts";
import {
  toFetchRequest,
  writeFetchResponse,
} from "../../../backend/src/http/node-adapter.ts";
import { createDb } from "../../../database/src/db.ts";

/**
 * Body dibaca mentah oleh adapter supaya batas 2 MB ditegakkan sebelum buffering.
 * `maxDuration` 60 dtk: `/cron/daily` (SPEC §10.1) melewati batas default Vercel.
 */
export const config = { api: { bodyParser: false }, maxDuration: 60 };

function allowedOrigins(): string[] {
  return [
    process.env.APP_ORIGIN,
    ...(process.env.ALLOWED_ORIGINS ?? "").split(","),
  ]
    .map((origin) => origin?.trim())
    .filter((origin): origin is string => Boolean(origin));
}

let app: ReturnType<typeof createApp> | undefined;

/** Satu Pool per proses; membuat Pool tiap request akan menghabiskan koneksi Neon. */
function getApp() {
  app ??= createApp({ db: createDb().db, allowedOrigins: allowedOrigins() });
  return app;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const response = await getApp().fetch(await toFetchRequest(req));
    await writeFetchResponse(res, response);
  } catch (err) {
    if (!(err instanceof ApiError)) console.error("[api] unhandled", err);
    const error = err instanceof ApiError ? err : internalError();
    await writeFetchResponse(
      res,
      Response.json(error.toBody(), { status: error.status }),
    );
  }
}
