// API レスポンス形式のヘルパ。
// すべての Route Handler はここを経由して返す。

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = {
  ok: false;
  error: { code: ApiErrorCode; message: string };
};

export type ApiErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INTERNAL";

export function ok<T>(data: T, status = 200): Response {
  const body: ApiOk<T> = { ok: true, data };
  return Response.json(body, { status });
}

export function err(
  code: ApiErrorCode,
  message: string,
  status = 400,
): Response {
  const body: ApiErr = { ok: false, error: { code, message } };
  return Response.json(body, { status });
}
