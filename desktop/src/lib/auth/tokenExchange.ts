/**
 * Typed response returned by the website's `POST /api/auth/token` proxy.
 * Only the fields the desktop app actually reads are declared here.
 */
export interface WebsiteTokenResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly user: {
    readonly id: string;
    readonly email: string;
  };
  /** Seconds until `accessToken` expires. Absent if the proxy omits it. */
  readonly accessTokenExpiresIn?: number;
}

/** Discriminated union of token exchange failures. */
export type TokenExchangeError =
  | { readonly kind: "INVALID_GRANT"; readonly message: string }
  | { readonly kind: "RATE_LIMITED"; readonly message: string }
  | { readonly kind: "NETWORK"; readonly message: string }
  | {
      readonly kind: "UNKNOWN";
      readonly message: string;
      readonly rawStatus?: number;
    };

/** Result of a token exchange attempt. */
export type TokenExchangeResult =
  | { readonly ok: true; readonly data: WebsiteTokenResponse }
  | { readonly ok: false; readonly error: TokenExchangeError };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Shape of the error body returned by the website proxy on non-2xx responses. */
interface ProxyErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}

/**
 * Maps the website proxy's error codes to the desktop's typed error union.
 *
 * Website error codes (per contract):
 *   INVALID_BODY    — bad request from desktop (config error)
 *   INVALID_GRANT   — code expired/used or verifier mismatch
 *   RATE_LIMITED    — WorkOS rate limit hit
 *   API_ERROR       — upstream WorkOS / network failure
 */
function classifyError(
  status: number,
  body: ProxyErrorBody,
): TokenExchangeError {
  const code = body.error?.code ?? "";
  const msg = body.error?.message ?? "Token exchange failed.";

  switch (code) {
    case "INVALID_GRANT":
      return { kind: "INVALID_GRANT", message: msg };
    case "RATE_LIMITED":
      return { kind: "RATE_LIMITED", message: msg };
    case "API_ERROR":
      // Upstream WorkOS / network failure — treat as transient network error.
      return { kind: "NETWORK", message: msg };
    default:
      // INVALID_BODY and UNKNOWN_CLIENT indicate a desktop configuration error.
      return { kind: "UNKNOWN", message: msg, rawStatus: status };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const WEBSITE_BASE_URL = "https://pinac.rajeshmondal.com";

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<TokenExchangeResult> {
  const tokenEndpoint = `${WEBSITE_BASE_URL}/api/auth/token`;

  let response: Response;
  try {
    response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
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
            : "Network request to token proxy failed.",
      },
    };
  }

  if (!response.ok) {
    let errorBody: ProxyErrorBody = {};
    try {
      errorBody = (await response.json()) as ProxyErrorBody;
    } catch {
      // Non-JSON error body — classify generically by status alone.
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
        message: "Token proxy returned a non-JSON success body.",
      },
    };
  }

  // Validate the shape of the success response.
  const accessToken = raw["access_token"];
  const refreshToken = raw["refresh_token"];
  const expiresIn = raw["expires_in"];
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
        message: "Token proxy response is missing expected fields.",
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
      },
      accessTokenExpiresIn:
        typeof expiresIn === "number" ? expiresIn : undefined,
    },
  };
}
