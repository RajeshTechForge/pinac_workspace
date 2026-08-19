import {
  getTokens,
  saveTokens,
  clearTokens,
  type StoredTokens,
} from "./secureStorage";

const DEFAULT_REFRESH_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes

function getRefreshIntervalMs(): number {
  const raw = import.meta.env.VITE_AUTH_REFRESH_INTERVAL_MS as
    string | undefined;
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_REFRESH_INTERVAL_MS;
}

/** Public user shape exposed to the UI layer. */
export interface CurrentUser {
  readonly id: string;
  readonly email: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly profilePictureUrl: string | null;
}

/** Minimal JWT payload fields we care about. */
interface JwtPayload {
  sub?: string;
  email?: string;
  sid?: string; // WorkOS session ID — used for server-side logout
  first_name?: string;
  last_name?: string;
  profile_picture_url?: string;
  exp?: number;
}

/** Result types for silentRefresh. */
export type RefreshResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "NO_TOKENS" | "NETWORK" | "INVALID_GRANT" | "UNKNOWN";
      readonly message: string;
    };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    // Base64url → base64 → decode
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

const REFRESH_ENDPOINT = "https://api.workos.com/user_management/authenticate";
const LOGOUT_ENDPOINT =
  "https://api.workos.com/user_management/sessions/logout";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getCurrentUser(): Promise<CurrentUser | null> {
  let stored: StoredTokens | null;
  try {
    stored = await getTokens();
  } catch {
    return null;
  }
  if (!stored) return null;

  const payload = decodeJwtPayload(stored.accessToken);
  if (!payload) return null;

  return {
    id: stored.userId,
    email: stored.userEmail,
    firstName: payload.first_name ?? null,
    lastName: payload.last_name ?? null,
    profilePictureUrl: payload.profile_picture_url ?? null,
  };
}

export async function isAuthenticated(): Promise<boolean> {
  try {
    const stored = await getTokens();
    if (!stored) return false;
    return stored.expiresAt > Date.now();
  } catch {
    return false;
  }
}

export async function silentRefresh(): Promise<RefreshResult> {
  let stored: StoredTokens | null;
  try {
    stored = await getTokens();
  } catch (e) {
    return { ok: false, reason: "UNKNOWN", message: String(e) };
  }

  if (!stored) {
    return {
      ok: false,
      reason: "NO_TOKENS",
      message: "No stored tokens to refresh.",
    };
  }

  let response: Response;
  try {
    response = await fetch(REFRESH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: stored.refreshToken,
        // No client_secret — public client.
      }),
    });
  } catch (networkErr) {
    // Network failure — don't clear tokens; the user might just be offline.
    return {
      ok: false,
      reason: "NETWORK",
      message:
        networkErr instanceof Error
          ? networkErr.message
          : "Network error during refresh.",
    };
  }

  if (!response.ok) {
    let body: Record<string, unknown> = {};
    try {
      body = (await response.json()) as Record<string, unknown>;
    } catch {
      /* ignore */
    }

    const errorCode = (body["error"] as string | undefined) ?? "";

    if (errorCode === "invalid_grant" || response.status === 401) {
      // Refresh token has been revoked or expired — session is dead.
      // Clear local tokens so the UI can prompt re-login.
      try {
        await clearTokens();
      } catch {
        /* best-effort */
      }
      return {
        ok: false,
        reason: "INVALID_GRANT",
        message: "Session expired. Please sign in again.",
      };
    }

    return {
      ok: false,
      reason: "UNKNOWN",
      message:
        (body["error_description"] as string | undefined) ??
        `HTTP ${response.status} from token endpoint.`,
    };
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await response.json()) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      reason: "UNKNOWN",
      message: "Non-JSON response from refresh endpoint.",
    };
  }

  const newAccessToken = raw["access_token"] as string | undefined;
  const newRefreshToken = raw["refresh_token"] as string | undefined;
  const expiresIn = raw["expires_in"] as number | undefined;

  if (!newAccessToken || !newRefreshToken) {
    return {
      ok: false,
      reason: "UNKNOWN",
      message: "Refresh response missing access_token or refresh_token.",
    };
  }

  try {
    await saveTokens({
      ...stored,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt: Date.now() + ((expiresIn ?? 300) - 30) * 1000,
    });
  } catch (saveErr) {
    return { ok: false, reason: "UNKNOWN", message: String(saveErr) };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Refresh timer
// ---------------------------------------------------------------------------

let refreshTimerHandle: ReturnType<typeof setInterval> | null = null;

export function startRefreshTimer(
  intervalMs: number = getRefreshIntervalMs(),
  onExpired?: () => void,
): () => void {
  // Stop any previously running timer.
  stopRefreshTimer();

  async function tick(): Promise<void> {
    const result = await silentRefresh();
    if (!result.ok && result.reason === "INVALID_GRANT") {
      stopRefreshTimer();
      onExpired?.();
    }
  }

  // Fire once immediately (covers the case where the app re-opens after a
  // long period and the token has already expired).
  void tick();

  refreshTimerHandle = setInterval(() => {
    void tick();
  }, intervalMs);

  return stopRefreshTimer;
}

/** Stops the refresh timer. Safe to call even if no timer is running. */
export function stopRefreshTimer(): void {
  if (refreshTimerHandle !== null) {
    clearInterval(refreshTimerHandle);
    refreshTimerHandle = null;
  }
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export async function logout(remoteRevoke = true): Promise<void> {
  stopRefreshTimer();

  if (remoteRevoke) {
    try {
      const stored = await getTokens();
      if (stored?.accessToken) {
        const payload = decodeJwtPayload(stored.accessToken);
        const sessionId = payload?.sid;

        if (sessionId) {
          // WorkOS server-side session revocation.
          // Endpoint: POST /user_management/sessions/logout  { session_id }
          // This invalidates the refresh token so it cannot be reused from
          // another device or process after logout.
          // Ref: https://workos.com/docs/reference/authkit/authentication
          await fetch(LOGOUT_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId }),
          });
          // Intentionally not checking the response — logout is best-effort.
          // If the request fails, tokens are still cleared locally.
        }
      }
    } catch {
      // Network failure during revocation — proceed with local logout.
    }
  }

  try {
    await clearTokens();
  } catch {
    // Swallow — even if clearTokens fails (e.g. permission error), the
    // refresh timer is stopped and the session_id is invalidated server-side.
  }
}
