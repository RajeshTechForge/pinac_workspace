/**
 * POST /api/auth/token — PKCE authorization-code exchange proxy.
 *
 * The desktop app POSTs { code, code_verifier, client_id } here after receiving
 * the authorization code via the pinac:// deep-link callback.  This endpoint
 * calls WorkOS on behalf of the desktop so that the WorkOS API key never leaves
 * the server and the token exchange follows the correct PKCE architecture.
 */

export const prerender = false;

import type { APIRoute } from "astro";
import { workos, WORKOS_CLIENT_ID } from "../../../lib/workos";

type TokenRequestBody = {
  code?: unknown;
  code_verifier?: unknown;
};

type TokenSuccess = {
  ok: true;
  access_token: string;
  refresh_token: string;
  /** Lifetime of the access token in seconds. */
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

/** Lifetime (seconds) when WorkOS omits accessTokenExpiresIn. */
const TOKEN_EXPIRES_IN = 300;

function json(body: TokenResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(
  status: number,
  code: TokenErrorCode,
  message: string,
): Response {
  return json({ ok: false, error: { code, message } }, status);
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export const POST: APIRoute = async ({ request }) => {
  // ── Parse body ────────────────────────────────────────────────────────────
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return errorResponse(
      400,
      "INVALID_BODY",
      "Request body must be valid JSON.",
    );
  }

  const { code, code_verifier } = (parsed ?? {}) as TokenRequestBody;

  // ── Validate code ─────────────────────────────────────────────────────────
  if (typeof code !== "string" || code.trim().length === 0) {
    return errorResponse(400, "INVALID_BODY", "A non-empty code is required.");
  }

  // ── Validate code_verifier ────────────────────────────────────────────────
  if (
    typeof code_verifier !== "string" ||
    !CODE_VERIFIER_RE.test(code_verifier)
  ) {
    return errorResponse(
      400,
      "INVALID_BODY",
      "code_verifier must be 43–128 URL-safe characters [A-Za-z0-9\\-._~] (RFC 7636 §4.1).",
    );
  }

  // ── Exchange code + verifier with WorkOS ──────────────────────────────────
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

    return json(body, 200);
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
      );
    }

    if (errCode === "rate_limit_exceeded" || /rate.limit/i.test(errMsg)) {
      return errorResponse(
        429,
        "RATE_LIMITED",
        "Too many token exchange attempts. Please wait a moment and try again.",
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
    );
  }
};
