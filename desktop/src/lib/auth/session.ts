/**
 * session.ts — Session lifecycle management for the Pinac desktop app.
 *
 * Responsibilities:
 *  - getCurrentUser()   — decode the stored access token's JWT payload (no sig verify).
 *  - isAuthenticated()  — check stored expiresAt without touching the network.
 *  - silentRefresh()    — use the refresh token to obtain a new access token.
 *  - startRefreshTimer()— schedule periodic silent refresh so the token never expires
 *                         while the app is open.
 *  - logout()           — clear local storage and optionally revoke the session server-side.
 *
 * NOTE on JWT decoding: We do not verify the JWT signature here. The access token
 * was just issued by WorkOS moments ago (or was just refreshed); we trust its contents
 * for the purpose of reading the user ID / email from the payload.  All actual
 * authorisation decisions happen on the server (WorkOS / backend) using the token.
 *
 * NOTE on token revocation: WorkOS supports server-side session logout via:
 *   POST https://api.workos.com/user_management/sessions/logout
 *   Body: { session_id }   (the session_id is a claim inside the access token JWT)
 * We extract session_id from the JWT payload during logout().
 */

import { getTokens, saveTokens, clearTokens, type StoredTokens } from "./secureStorage";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * How often (ms) the silent refresh timer fires.
 *
 * WorkOS access tokens default to 5 minutes (300 s). We refresh at
 * 4-minute intervals — 1 minute before worst-case expiry — giving a
 * comfortable buffer even if the device clock drifts slightly.
 *
 * Override via VITE_AUTH_REFRESH_INTERVAL_MS in desktop/.env.
 */
const DEFAULT_REFRESH_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes

function getRefreshIntervalMs(): number {
  const raw = import.meta.env.VITE_AUTH_REFRESH_INTERVAL_MS as string | undefined;
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_REFRESH_INTERVAL_MS;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  sid?: string;          // WorkOS session ID — used for server-side logout
  first_name?: string;
  last_name?: string;
  profile_picture_url?: string;
  exp?: number;
}

/** Result types for silentRefresh. */
export type RefreshResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "NO_TOKENS" | "NETWORK" | "INVALID_GRANT" | "UNKNOWN"; readonly message: string };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Decodes the payload of a JWT without verifying the signature.
 * Safe to use here because the token came from our own secure encrypted storage,
 * not from an untrusted external source.
 */
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
const LOGOUT_ENDPOINT  = "https://api.workos.com/user_management/sessions/logout";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the current user decoded from the stored access token,
 * or `null` if not authenticated.
 */
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
    id:                stored.userId,
    email:             stored.userEmail,
    firstName:         payload.first_name         ?? null,
    lastName:          payload.last_name          ?? null,
    profilePictureUrl: payload.profile_picture_url ?? null,
  };
}

/**
 * Returns `true` if there are stored tokens whose access token has not yet expired.
 * Does not make a network call — checks the locally stored `expiresAt` timestamp.
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const stored = await getTokens();
    if (!stored) return false;
    return stored.expiresAt > Date.now();
  } catch {
    return false;
  }
}

/**
 * Attempts a silent token refresh using the stored refresh token.
 *
 * On success, overwrites the stored tokens with the new access/refresh pair.
 * On failure (invalid_grant = refresh token revoked/expired), clears tokens
 * so `isAuthenticated()` returns false and the UI can prompt re-login.
 *
 * @returns A typed result — never throws.
 */
export async function silentRefresh(): Promise<RefreshResult> {
  let stored: StoredTokens | null;
  try {
    stored = await getTokens();
  } catch (e) {
    return { ok: false, reason: "UNKNOWN", message: String(e) };
  }

  if (!stored) {
    return { ok: false, reason: "NO_TOKENS", message: "No stored tokens to refresh." };
  }

  const nativeClientId = import.meta.env.VITE_WORKOS_NATIVE_CLIENT_ID as string | undefined;
  if (!nativeClientId) {
    return {
      ok: false,
      reason: "UNKNOWN",
      message: "VITE_WORKOS_NATIVE_CLIENT_ID is not set.",
    };
  }

  let response: Response;
  try {
    response = await fetch(REFRESH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type:    "refresh_token",
        client_id:     nativeClientId,
        refresh_token: stored.refreshToken,
        // No client_secret — public client.
      }),
    });
  } catch (networkErr) {
    // Network failure — don't clear tokens; the user might just be offline.
    return {
      ok: false,
      reason: "NETWORK",
      message: networkErr instanceof Error ? networkErr.message : "Network error during refresh.",
    };
  }

  if (!response.ok) {
    let body: Record<string, unknown> = {};
    try { body = (await response.json()) as Record<string, unknown>; } catch { /* ignore */ }

    const errorCode = (body["error"] as string | undefined) ?? "";

    if (errorCode === "invalid_grant" || response.status === 401) {
      // Refresh token has been revoked or expired — session is dead.
      // Clear local tokens so the UI can prompt re-login.
      try { await clearTokens(); } catch { /* best-effort */ }
      return {
        ok: false,
        reason: "INVALID_GRANT",
        message: "Session expired. Please sign in again.",
      };
    }

    return {
      ok: false,
      reason: "UNKNOWN",
      message: (body["error_description"] as string | undefined) ?? `HTTP ${response.status} from token endpoint.`,
    };
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await response.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "UNKNOWN", message: "Non-JSON response from refresh endpoint." };
  }

  const newAccessToken  = raw["access_token"]  as string | undefined;
  const newRefreshToken = raw["refresh_token"] as string | undefined;
  const expiresIn       = raw["expires_in"]    as number | undefined;

  if (!newAccessToken || !newRefreshToken) {
    return { ok: false, reason: "UNKNOWN", message: "Refresh response missing access_token or refresh_token." };
  }

  try {
    await saveTokens({
      ...stored,
      accessToken:  newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt:    Date.now() + ((expiresIn ?? 300) - 30) * 1000,
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

/**
 * Starts a repeating interval that calls `silentRefresh()` to keep the
 * access token fresh.
 *
 * - Fires once immediately on startup, then repeats at `intervalMs`.
 * - If a refresh fails with INVALID_GRANT (session revoked), the timer stops
 *   itself — there is nothing to refresh and the UI will prompt re-login.
 * - Returns a cleanup function that stops the timer (call it on logout or
 *   component unmount).
 *
 * @param intervalMs — Override the default 4-minute interval.
 *                     Configurable via VITE_AUTH_REFRESH_INTERVAL_MS in .env.
 * @param onExpired  — Called if the refresh token is found to be invalid/revoked.
 *                     Use this to redirect the UI to the login screen.
 */
export function startRefreshTimer(
  intervalMs: number = getRefreshIntervalMs(),
  onExpired?: () => void
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

  refreshTimerHandle = setInterval(() => { void tick(); }, intervalMs);

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

/**
 * Signs the user out.
 *
 * 1. Stops the refresh timer.
 * 2. Optionally revokes the WorkOS session server-side so the refresh token
 *    can no longer be used from any device.
 * 3. Clears locally stored tokens.
 *
 * @param remoteRevoke — Set to `false` to skip the network revocation call
 *                       (e.g. if the device is known to be offline).
 *                       Defaults to `true`.
 */
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
