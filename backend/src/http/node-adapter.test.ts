// @vitest-environment node
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import {
  MAX_BODY_BYTES,
  toFetchRequest,
  writeFetchResponse,
} from "./node-adapter.ts";

function fakeReq(
  init: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
): IncomingMessage {
  const stream = Readable.from(
    init.body === undefined ? [] : [Buffer.from(init.body)],
  );
  return Object.assign(stream, {
    method: init.method ?? "GET",
    url: init.url ?? "/api/v1/health",
    headers: { host: "lakoo.test", ...init.headers },
  }) as unknown as IncomingMessage;
}

function fakeRes() {
  const headers: Record<string, string | string[]> = {};
  let body: Buffer = Buffer.alloc(0);
  const res = {
    statusCode: 0,
    setHeader: (key: string, value: string | string[]) => {
      headers[key.toLowerCase()] = value;
    },
    end: (chunk: Buffer) => {
      body = chunk;
    },
  };
  return {
    res: res as unknown as ServerResponse,
    headers,
    getBody: () => body,
  };
}

describe("toFetchRequest", () => {
  it("memetakan method, url, dan header", async () => {
    const request = await toFetchRequest(
      fakeReq({
        method: "POST",
        url: "/api/v1/auth/login",
        headers: { "content-type": "application/json" },
      }),
    );
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://lakoo.test/api/v1/auth/login");
    expect(request.headers.get("content-type")).toBe("application/json");
  });

  it("tidak mengirim body untuk GET", async () => {
    const request = await toFetchRequest(fakeReq({ body: "abaikan" }));
    expect(request.body).toBeNull();
  });

  it("meneruskan body JSON apa adanya", async () => {
    const request = await toFetchRequest(
      fakeReq({ method: "POST", body: '{"email":"a@b.c"}' }),
    );
    expect(await request.text()).toBe('{"email":"a@b.c"}');
  });

  it("menolak body di atas 2 MB sebelum membaca seluruhnya", async () => {
    const oversized = Buffer.alloc(MAX_BODY_BYTES + 1, 0x61);
    const stream = Readable.from([oversized]);
    const req = Object.assign(stream, {
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { host: "lakoo.test" },
    }) as unknown as IncomingMessage;

    await expect(toFetchRequest(req)).rejects.toMatchObject({
      code: "payload_too_large",
      status: 413,
    });
  });
});

describe("writeFetchResponse", () => {
  it("menyalin status, header, dan body", async () => {
    const { res, headers, getBody } = fakeRes();
    await writeFetchResponse(
      res,
      new Response(JSON.stringify({ status: "ok" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.statusCode).toBe(201);
    expect(headers["content-type"]).toContain("application/json");
    expect(getBody().toString()).toBe('{"status":"ok"}');
  });

  it("mempertahankan lebih dari satu Set-Cookie", async () => {
    const { res, headers } = fakeRes();
    const response = new Response(null, { status: 204 });
    response.headers.append("set-cookie", "lakoo_session=abc; HttpOnly");
    response.headers.append("set-cookie", "lakoo_session=; Max-Age=0");
    await writeFetchResponse(res, response);
    expect(headers["set-cookie"]).toEqual([
      "lakoo_session=abc; HttpOnly",
      "lakoo_session=; Max-Age=0",
    ]);
  });
});
