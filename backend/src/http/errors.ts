/** Kode error kontrak `docs/api/openapi.yaml` (components/schemas/Error). */
export type ErrorCode =
  | "validation_error"
  | "unauthenticated"
  | "bad_origin"
  | "forbidden_demo"
  | "not_found"
  | "email_taken"
  | "invalid_credentials"
  | "duplicate_product_name"
  | "insufficient_stock"
  | "opname_negative"
  | "edit_window_closed"
  | "plan_not_applicable"
  | "plan_already_active"
  | "plan_invalid_state"
  | "step_invalid_state"
  | "idempotency_key_reused"
  | "rate_limited"
  | "payload_too_large"
  | "internal_error";

export interface ErrorLine {
  index: number;
  code: string;
  message: string;
}

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    fields?: Record<string, string>;
    lines?: ErrorLine[];
    existingProductId?: string;
  };
}

export interface ErrorExtra {
  fields?: Record<string, string>;
  lines?: ErrorLine[];
  existingProductId?: string;
}

/** Satu-satunya cara melempar kegagalan dari handler; `onError` mengubahnya jadi body kontrak. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly extra: ErrorExtra;
  /** Header respons tambahan (mis. `Retry-After`), terpisah dari body. */
  readonly headers: Record<string, string>;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    extra: ErrorExtra = {},
    headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.extra = extra;
    this.headers = headers;
  }

  toBody(): ErrorBody {
    return { error: { code: this.code, message: this.message, ...this.extra } };
  }
}

export const badOrigin = (): ApiError =>
  new ApiError(403, "bad_origin", "Permintaan harus dari aplikasi Lakoo.");

export const unauthenticated = (): ApiError =>
  new ApiError(
    401,
    "unauthenticated",
    "Sesi tidak ditemukan. Silakan masuk lagi.",
  );

export const duplicateProductName = (): ApiError =>
  new ApiError(
    409,
    "duplicate_product_name",
    "Nama produk sudah dipakai di toko ini.",
  );

export const notFound = (): ApiError =>
  new ApiError(404, "not_found", "Data yang dicari tidak ada.");

export const validationError = (fields: Record<string, string>): ApiError =>
  new ApiError(400, "validation_error", "Ada isian yang perlu diperbaiki.", {
    fields,
  });

export const internalError = (
  message = "Ada gangguan di server. Coba lagi.",
): ApiError => new ApiError(500, "internal_error", message);

/** Ketergantungan eksternal (DB) tidak terjangkau — kontrak `/health` memakai 503. */
export const serviceUnavailable = (
  message = "Layanan sedang tidak tersedia.",
): ApiError => new ApiError(503, "internal_error", message);

/** Pesan selalu generik supaya tidak membocorkan email mana yang terdaftar. */
export const invalidCredentials = (): ApiError =>
  new ApiError(401, "invalid_credentials", "Email atau kata sandi salah.");

export const emailTaken = (): ApiError =>
  new ApiError(409, "email_taken", "Email ini sudah terdaftar.");

export const payloadTooLarge = (): ApiError =>
  new ApiError(413, "payload_too_large", "Data yang dikirim terlalu besar.");
