import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fieldMessage } from "./validate.ts";

/** Kontrak (`openapi.yaml`, Error.message) mewajibkan pesan bahasa Indonesia.
 *  Pesan DEFAULT Zod v3 berbahasa Inggris, jadi harus dipetakan. */
function firstIssue(schema: z.ZodType, input: unknown): z.ZodIssue {
  const result = schema.safeParse(input);
  if (result.success) throw new Error("seharusnya gagal parse");
  const issue = result.error.issues[0];
  if (issue === undefined) throw new Error("seharusnya ada issue");
  return issue;
}

describe("fieldMessage — pesan default Zod jadi bahasa Indonesia", () => {
  it("too_small pada string", () => {
    const issue = firstIssue(z.object({ name: z.string().min(1) }), {
      name: "",
    });
    expect(fieldMessage(issue)).toBe("minimal 1 karakter");
  });

  it("too_big pada array", () => {
    const issue = firstIssue(z.object({ lines: z.array(z.string()).max(2) }), {
      lines: ["a", "b", "c"],
    });
    expect(fieldMessage(issue)).toBe("maksimal 2 baris");
  });

  it("invalid_string pada email", () => {
    const issue = firstIssue(z.object({ email: z.string().email() }), {
      email: "bukan-email",
    });
    expect(fieldMessage(issue)).toBe("Format email tidak valid.");
  });

  it("invalid_string pada uuid", () => {
    const issue = firstIssue(z.object({ id: z.string().uuid() }), { id: "x" });
    expect(fieldMessage(issue)).toBe("Format UUID tidak valid.");
  });

  it("invalid_type", () => {
    const issue = firstIssue(z.object({ qty: z.number().int() }), {
      qty: "abc",
    });
    expect(fieldMessage(issue)).toBe(
      "Format tidak sesuai (diharapkan number).",
    );
  });

  it('field wajib yang hilang → "Wajib diisi." (bukan "Required")', () => {
    // Zod v3 memakai pesan default "Required" untuk invalid_type dengan
    // received "undefined". Guard teks harus mengenalinya, kalau tidak lolos
    // sebagai pesan kustom dan tetap berbahasa Inggris di form login/register.
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
    });
    const issue = firstIssue(schema, {});
    expect(issue.message).toBe("Required"); // bukti ini memang default Zod
    expect(fieldMessage(issue)).toBe("Wajib diisi.");
  });

  it("unrecognized_keys pada skema strict", () => {
    const issue = firstIssue(z.object({ a: z.string() }).strict(), {
      a: "x",
      b: 1,
    });
    expect(fieldMessage(issue)).toBe("Ada field yang tidak dikenal.");
  });
});

describe("fieldMessage — batas NYATA dari issue, bukan literal", () => {
  it("too_small/too_big pada NUMBER (kasus ai/schema.ts duration_days)", () => {
    // z.number().int().min(3).max(21) — batas harus dibaca dari issue, kalau
    // tidak skema berbatas lain dapat pesan yang salah.
    const schema = z.object({ duration_days: z.number().int().min(3).max(21) });
    expect(fieldMessage(firstIssue(schema, { duration_days: 2 }))).toBe(
      "harus minimal 3",
    );
    expect(fieldMessage(firstIssue(schema, { duration_days: 22 }))).toBe(
      "harus maksimal 21",
    );
  });

  it("too_big pada string memakai batas skema", () => {
    const schema = z.object({ title: z.string().max(60) });
    expect(fieldMessage(firstIssue(schema, { title: "x".repeat(61) }))).toBe(
      "maksimal 60 karakter",
    );
  });
});

describe("fieldMessage — MEMPERTAHANKAN pesan kustom skema", () => {
  it("regex dengan pesan sendiri tidak ditimpa pemetaan", () => {
    const issue = firstIssue(
      z.object({
        receivedOn: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "tanggal harus format YYYY-MM-DD"),
      }),
      { receivedOn: "bukan-tanggal" },
    );
    expect(fieldMessage(issue)).toBe("tanggal harus format YYYY-MM-DD");
  });

  it("uuid dengan pesan sendiri tidak ditimpa pemetaan", () => {
    const issue = firstIssue(
      z.object({ productId: z.string().uuid("productId harus UUID") }),
      { productId: "x" },
    );
    expect(fieldMessage(issue)).toBe("productId harus UUID");
  });
});

describe("fieldMessage — satu respons, beberapa field, semua Indonesia", () => {
  it("campuran field wajib + format → tidak ada yang lolos berbahasa Inggris", () => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
    });
    const result = schema.safeParse({ password: "x" });
    if (result.success) throw new Error("seharusnya gagal parse");
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      fields[issue.path.join(".")] ??= fieldMessage(issue);
    }
    expect(fields).toEqual({
      email: "Wajib diisi.",
      password: "minimal 8 karakter",
    });
    // Regresi QA: "Required" dulu lolos karena guard teks tak mengenalinya.
    expect(Object.values(fields).join(" ")).not.toMatch(/^Required$|Required/);
  });
});
