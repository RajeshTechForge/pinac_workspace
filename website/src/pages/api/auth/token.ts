/**
 * POST /api/auth/token — PKCE authorization-code exchange proxy.
 *
 * The desktop app POSTs { code, code_verifier } here after receiving
 * the authorization code via the pinac:// deep-link callback. This endpoint
 * exchanges the code with Supabase GoTrue so that the token exchange follows
 * the correct PKCE architecture and returns the expected contract.
 */

export const prerender = false;

import type { APIRoute } from "astro";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  toSafeUser,
} from "../../../lib/supabase";

const TAURI_ORIGINS = new Set([
  "http://localhost:1420", // Dev mode
  "tauri://localhost", // macOS/Linux
  "https://tauri.localhost", // Windows (WebView2)
]);

function resolveOrigin(request: Request): string | null {
  const origin = request.headers.get("Origin");
  return origin !== null && TAURI_ORIGINS.has(origin) ? origin : null;
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "7200",
    Vary: "Origin",
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TokenRequestBody = {
  code?: unknown;
  code_verifier?: unknown;
};

type TokenSuccess = {
  ok: true;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
};

type TokenErrorCode =
  | "INVALID_BODY"
  | "UNKNOWN_CLIENT"
  | "INVALID_GRANT"
  | "RATE_LIMITED"
  | "API_ERROR";

type TokenError = {
  ok: false;
  error: {
    code: TokenErrorCode;
    message: string;
  };
};

type TokenResponse = TokenSuccess | TokenError;

const CODE_VERIFIER_RE = /^[A-Za-z0-9\-._~]{43,128}$/;

function json(body: TokenResponse, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function errorResponse(
  status: number,
  code: TokenErrorCode,
  message: string,
  origin: string,
): Response {
  return json({ ok: false, error: { code, message } }, status, origin);
}

// ---------------------------------------------------------------------------
// OPTIONS — CORS preflight handler
// ---------------------------------------------------------------------------

export const OPTIONS: APIRoute = ({ request }) => {
  const origin = resolveOrigin(request);
  if (origin === null) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
};

// ---------------------------------------------------------------------------
// POST — token exchange handler
// ---------------------------------------------------------------------------

export const POST: APIRoute = async ({ request }) => {
  const origin = resolveOrigin(request) ?? "";

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return errorResponse(
      400,
      "INVALID_BODY",
      "Request body must be valid JSON.",
      origin,
    );
  }

  const { code, code_verifier } = (parsed ?? {}) as TokenRequestBody;

  // Validate code
  if (typeof code !== "string" || code.trim().length === 0) {
    return errorResponse(
      400,
      "INVALID_BODY",
      "A non-empty code is required.",
      origin,
    );
  }

  // Validate code_verifier (RFC 7636 §4.1)
  if (
    typeof code_verifier !== "string" ||
    !CODE_VERIFIER_RE.test(code_verifier)
  ) {
    return errorResponse(
      400,
      "INVALID_BODY",
      "code_verifier must be 43–128 URL-safe characters [A-Za-z0-9\\-._~] (RFC 7636 §4.1).",
      origin,
    );
  }

  // Exchange code + code_verifier with Supabase GoTrue PKCE endpoint
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        auth_code: code.trim(),
        code_verifier: code_verifier.trim(),
      }),
    });

    const data = (await res.json().catch(() => null)) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      user?: {
        id: string;
        email?: string | null;
        user_metadata?: Record<string, unknown> | null;
      };
      error?: string;
      error_description?: string;
      msg?: string;
    } | null;

    if (!res.ok || !data || !data.access_token || !data.user) {
      const errMsg =
        data?.error_description ||
        data?.msg ||
        data?.error ||
        "Token exchange failed.";

      if (
        res.status === 400 ||
        res.status === 401 ||
        /invalid.grant/i.test(errMsg) ||
        /invalid_grant/i.test(errMsg) ||
        /expired/i.test(errMsg)
      ) {
        return errorResponse(
          401,
          "INVALID_GRANT",
          "The authorization code is invalid, expired, or the code_verifier does not match.",
          origin,
        );
      }

      if (res.status === 429 || /rate/i.test(errMsg)) {
        return errorResponse(
          429,
          "RATE_LIMITED",
          "Too many token exchange attempts. Please wait a moment and try again.",
          origin,
        );
      }

      console.error("[api/auth/token] Supabase PKCE exchange failed:", errMsg);
      return errorResponse(
        502,
        "API_ERROR",
        "Token exchange failed. Please try again.",
        origin,
      );
    }

    const safeUser = toSafeUser(data.user);

    const body: TokenSuccess = {
      ok: true,
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? "",
      expires_in: data.expires_in ?? 3600,
      user: {
        id: safeUser.id,
        email: safeUser.email,
        first_name: safeUser.firstName,
        last_name: safeUser.lastName,
      },
    };

    return json(body, 200, origin);
  } catch (err) {
    console.error(
      "[api/auth/token] Unexpected error during token exchange:",
      err,
    );
    return errorResponse(
      502,
      "API_ERROR",
      "Token exchange failed. Please try again.",
      origin,
    );
  }
};
