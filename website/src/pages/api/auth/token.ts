/**
 * POST /api/auth/token — PKCE authorization-code exchange proxy.
 *
 * The desktop app POSTs { code, code_verifier } here after receiving
 * the authorization code via the pinac:// deep-link callback.  This endpoint
 * calls WorkOS on behalf of the desktop so that the WorkOS API key never leaves
 * the server and the token exchange follows the correct PKCE architecture.
 *
 */

export const prerender = false;

import type { APIRoute } from "astro";
import { workos, WORKOS_CLIENT_ID } from "../../../lib/workos";

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

const TOKEN_EXPIRES_IN = 300;

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

  // Validate code_verifier
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

  // Exchange code + verifier with WorkOS
  try {
    const authRes = await workos.userManagement.authenticateWithCode({
      clientId: WORKOS_CLIENT_ID,
      code: code.trim(),
      codeVerifier: code_verifier,
    });

    const body: TokenSuccess = {
      ok: true,
      access_token: authRes.accessToken,
      refresh_token: authRes.refreshToken,
      expires_in: TOKEN_EXPIRES_IN,
      user: {
        id: authRes.user.id,
        email: authRes.user.email,
        first_name: authRes.user.firstName ?? null,
        last_name: authRes.user.lastName ?? null,
      },
    };

    return json(body, 200, origin);
  } catch (err) {
    const e = err as { code?: string; message?: string };
    const errCode = e.code ?? "";
    const errMsg = e.message ?? "";

    // WorkOS returns `invalid_grant` when the code is expired, already used,
    // or the code_verifier does not match the original code_challenge.
    if (
      errCode === "invalid_grant" ||
      /invalid.grant/i.test(errMsg) ||
      errCode === "invalid_credentials" ||
      /invalid.credentials/i.test(errMsg)
    ) {
      return errorResponse(
        401,
        "INVALID_GRANT",
        "The authorization code is invalid, expired, or the code_verifier does not match.",
        origin,
      );
    }

    if (errCode === "rate_limit_exceeded" || /rate.limit/i.test(errMsg)) {
      return errorResponse(
        429,
        "RATE_LIMITED",
        "Too many token exchange attempts. Please wait a moment and try again.",
        origin,
      );
    }

    console.error(
      "[api/auth/token] WorkOS authenticateWithCode failed:",
      errMsg,
    );
    return errorResponse(
      502,
      "API_ERROR",
      "Token exchange failed. Please try again.",
      origin,
    );
  }
};
