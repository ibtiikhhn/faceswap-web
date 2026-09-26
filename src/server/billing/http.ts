import { HttpError, assertOrigin } from "@/server/http";
import { BillingSetupError } from "./catalog";

export type JsonResponseInit = {
  status?: number;
  headers?: HeadersInit;
};

export function json(data: unknown, init: JsonResponseInit = {}): Response {
  return Response.json(data, {
    status: init.status ?? 200,
    headers: {"Cache-Control":"private, no-store",...init.headers},
  });
}

export function errorJson(code: string, message: string, status = 400, extra?: Record<string, unknown>): Response {
  return json(
    {
      error: {
        code,
        message,
        ...extra,
      },
    },
    { status },
  );
}

export function billingErrorResponse(error: unknown): Response {
  if (error instanceof HttpError) return errorJson(error.code,error.message,error.status);
  if (error instanceof BillingSetupError) {
    return errorJson(error.code, error.message, 503, { missing: error.missing });
  }

  if (error instanceof SyntaxError) {
    return errorJson("invalid_json", "Request body must be valid JSON.", 400);
  }

  return errorJson("billing_error", "Billing request failed.", 500);
}

export function requireSameOrigin(request:Request):void { assertOrigin(request); }

export function isForbiddenOriginError(error: unknown): boolean {
  return error instanceof Error && error.name === "ForbiddenOriginError";
}
