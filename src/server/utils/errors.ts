import "server-only";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function badRequest(message: string, details?: unknown): ApiError {
  return new ApiError(400, "BAD_REQUEST", message, details);
}

export function unauthorized(message = "Unauthorized"): ApiError {
  return new ApiError(401, "UNAUTHORIZED", message);
}

export function forbidden(message = "Forbidden"): ApiError {
  return new ApiError(403, "FORBIDDEN", message);
}

export function notFound(resource = "Resource"): ApiError {
  return new ApiError(404, "NOT_FOUND", `${resource} not found`);
}
