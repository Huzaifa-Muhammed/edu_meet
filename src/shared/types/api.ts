/* ── Uniform API response envelope ── */
export interface ApiOk<T = unknown> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T = unknown> = ApiOk<T> | ApiError;

/* ── Auth ── */
export interface SessionRequest {
  idToken: string;
}

export interface SessionResponse {
  uid: string;
  email: string;
  role: string;
  displayName: string;
  photoUrl?: string;
}

/* ── Decoded token payload used in route handlers ── */
export interface AuthUser {
  uid: string;
  email: string;
  role: string;
  displayName: string;
  photoUrl?: string;
}
