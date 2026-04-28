import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "./errors";

/** Success response */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

/** Error response — maps known error types to status codes */
export function fail(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.statusCode },
    );
  }

  // Firestore "not found" errors
  if (
    error instanceof Error &&
    error.message.includes("NOT_FOUND")
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "NOT_FOUND", message: "Resource not found" },
      },
      { status: 404 },
    );
  }

  console.error("[API Error]", error);
  return NextResponse.json(
    {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Internal server error" },
    },
    { status: 500 },
  );
}
