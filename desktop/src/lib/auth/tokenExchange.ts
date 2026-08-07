export interface WorkOSTokenResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  /** WorkOS user object — keep only the fields we need. */
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly firstName: string | null;
    readonly lastName: string | null;
    readonly profilePictureUrl: string | null;
  };
  /** Access token expiry in seconds from now, if provided by WorkOS. */
  readonly accessTokenExpiresIn?: number;
}

/** Discriminated union of token exchange failures. */
export type TokenExchangeError =
  | { readonly kind: "INVALID_GRANT"; readonly message: string }
  | { readonly kind: "EXPIRED_CODE"; readonly message: string }
  | { readonly kind: "NETWORK"; readonly message: string }
  | {
      readonly kind: "UNKNOWN";
      readonly message: string;
      readonly rawStatus?: number;
    };

/** Result of a token exchange attempt. */
export type TokenExchangeResult =
  | { readonly ok: true; readonly data: WorkOSTokenResponse }
  | { readonly ok: false; readonly error: TokenExchangeError };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const TOKEN_ENDPOINT = "https://api.workos.com/user_management/authenticate";

interface WorkOSErrorBody {
  error?: string;
  error_description?: string;
  code?: string;
  message?: string;
}

function classifyError(
  status: number,
  body: WorkOSErrorBody,
): TokenExchangeError {
  const errorCode = body.error ?? body.code ?? "";
  const msg =
    body.error_description ?? body.message ?? "Token exchange failed.";

  if (errorCode === "invalid_grant" || errorCode === "invalid_code") {
    return { kind: "INVALID_GRANT", message: msg };
  }
  if (
    errorCode === "expired_code" ||
    errorCode === "authorization_code_expired"
  ) {
    return { kind: "EXPIRED_CODE", message: msg };
  }
  return { kind: "UNKNOWN", message: msg, rawStatus: status };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  clientId: string,
): Promise<TokenExchangeResult> {
  let response: Response;
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: clientId,
        code,
        code_verifier: codeVerifier,
        // Intentionally omitting client_secret — this is a public client.
        // PKCE provides the equivalent security guarantee for native apps.
      }),
    });
  } catch (networkErr) {
    return {
      ok: false,
      error: {
        kind: "NETWORK",
        message:
          networkErr instanceof Error
            ? networkErr.message
            : "Network request to WorkOS token endpoint failed.",
      },
    };
  }

  if (!response.ok) {
    let errorBody: WorkOSErrorBody = {};
    try {
      errorBody = (await response.json()) as WorkOSErrorBody;
    } catch {
      // Non-JSON error body — classify generically.
    }
    return {
      ok: false,
      error: classifyError(response.status, errorBody),
    };
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await response.json()) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      error: {
        kind: "UNKNOWN",
        message: "WorkOS returned a non-JSON success body.",
      },
    };
  }

  // Validate the shape of the response.
  const accessToken = raw["access_token"];
  const refreshToken = raw["refresh_token"];
  const user = raw["user"] as Record<string, unknown> | undefined;

  if (
    typeof accessToken !== "string" ||
    typeof refreshToken !== "string" ||
    !user ||
    typeof user["id"] !== "string" ||
    typeof user["email"] !== "string"
  ) {
    return {
      ok: false,
      error: {
        kind: "UNKNOWN",
        message: "WorkOS token response is missing expected fields.",
      },
    };
  }

  return {
    ok: true,
    data: {
      accessToken,
      refreshToken,
      user: {
        id: user["id"] as string,
        email: user["email"] as string,
        firstName: (user["first_name"] as string | null | undefined) ?? null,
        lastName: (user["last_name"] as string | null | undefined) ?? null,
        profilePictureUrl:
          (user["profile_picture_url"] as string | null | undefined) ?? null,
      },
      // WorkOS may return expires_in (seconds); if absent, default to 300s (5 min).
      accessTokenExpiresIn:
        typeof raw["expires_in"] === "number" ? raw["expires_in"] : 300,
    },
  };
}
