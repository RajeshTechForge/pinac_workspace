/**
 * authFlow.ts — Initiates the PKCE Authorization Code flow for the Pinac desktop app.
 *
 * Flow summary (per RFC 8252 / RFC 7636):
 *  1. Generate code_verifier (in memory only), code_challenge, state.
 *  2. Store { codeVerifier, expiresAt } in an in-memory Map keyed by state.
 *  3. Build the URL to the website's /desktop-login route with PKCE params.
 *  4. Open the URL in the system browser (never in Tauri's own webview).
 *  5. Await the deep link callback handled by deepLinkHandler.ts.
 */

import { open } from "@tauri-apps/plugin-opener";
import { generateCodeVerifier, generateCodeChallenge, generateState } from "./pkce";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of an in-flight PKCE auth attempt. */
interface PendingFlow {
  /** The raw verifier — held ONLY in memory, never serialised to disk. */
  readonly codeVerifier: string;
  /** Unix timestamp (ms) after which this flow is considered expired. */
  readonly expiresAt: number;
}

// ---------------------------------------------------------------------------
// In-memory flow store
// ---------------------------------------------------------------------------

/**
 * Typed, module-level store for in-flight auth attempts.
 *
 * Keyed by the random `state` string so concurrent login attempts don't
 * clobber each other (e.g. user clicks Login twice quickly).
 *
 * SECURITY:
 * - Never iterate or log the values of this Map.
 * - Entries are cleared immediately on success, failure, or timeout.
 * - `state` keys are 64-character hex strings (256 bits of entropy).
 */
const pendingFlows = new Map<string, PendingFlow>();

/** How long (ms) a pending flow is valid before it is considered abandoned. */
const FLOW_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Removes all flows whose TTL has expired. Called before each new flow. */
function pruneExpiredFlows(): void {
  const now = Date.now();
  for (const [state, flow] of pendingFlows) {
    if (flow.expiresAt < now) {
      pendingFlows.delete(state);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Starts a PKCE login attempt:
 *  1. Generates verifier / challenge / state.
 *  2. Stores the verifier in memory (keyed by state, TTL = 10 min).
 *  3. Opens the system browser to the website's /desktop-login route.
 *
 * After calling this, the UI should indicate "Waiting for browser login…"
 * and listen for `"auth:success"` / `"auth:error"` events from deepLinkHandler.ts.
 *
 * @throws if the `VITE_WEBSITE_BASE_URL` env var is not set, or if the
 *         browser open call fails.
 */
export async function startLogin(): Promise<void> {
  // Read the website origin from Vite env.
  // Set VITE_WEBSITE_BASE_URL in desktop/.env (e.g. https://pinac.dev).
  const websiteBaseUrl = import.meta.env.VITE_WEBSITE_BASE_URL as string | undefined;
  if (!websiteBaseUrl) {
    throw new Error(
      "[auth] VITE_WEBSITE_BASE_URL is not set. Add it to desktop/.env."
    );
  }

  // Read the native (public) WorkOS client ID from Vite env.
  // This is safe to embed — it's a public client, no secret.
  const nativeClientId = import.meta.env.VITE_WORKOS_NATIVE_CLIENT_ID as string | undefined;
  if (!nativeClientId) {
    throw new Error(
      "[auth] VITE_WORKOS_NATIVE_CLIENT_ID is not set. Add it to desktop/.env."
    );
  }

  // Prune stale flows before adding a new one.
  pruneExpiredFlows();

  // Generate fresh PKCE params for this attempt.
  const codeVerifier = generateCodeVerifier();
  const [codeChallenge, state] = await Promise.all([
    generateCodeChallenge(codeVerifier),
    Promise.resolve(generateState()),
  ]);

  // Store in memory — never persisted.
  pendingFlows.set(state, {
    codeVerifier,
    expiresAt: Date.now() + FLOW_TTL_MS,
  });

  // Build the URL to the website's desktop-login relay route.
  // The website validates and forwards these PKCE params to WorkOS's
  // getAuthorizationUrl call, then redirects the browser into the
  // existing custom-UI sign-in experience.
  const loginUrl = new URL(`${websiteBaseUrl}/desktop-login`);
  loginUrl.searchParams.set("code_challenge", codeChallenge);
  loginUrl.searchParams.set("code_challenge_method", "S256");
  loginUrl.searchParams.set("state", state);
  loginUrl.searchParams.set("client_id", nativeClientId);

  // RFC 8252 §4: MUST use the system browser, never an embedded webview.
  // tauri-plugin-opener's open() uses the OS default browser handler.
  await open(loginUrl.toString());
}

/**
 * Retrieves a pending flow by its state token, or `undefined` if not found
 * or already expired.  Used by deepLinkHandler.ts.
 */
export function getPendingFlow(state: string): PendingFlow | undefined {
  const flow = pendingFlows.get(state);
  if (!flow) return undefined;
  if (flow.expiresAt < Date.now()) {
    pendingFlows.delete(state);
    return undefined;
  }
  return flow;
}

/**
 * Removes a pending flow by its state token.  Must be called by
 * deepLinkHandler.ts immediately after a successful or failed token exchange.
 */
export function clearPendingFlow(state: string): void {
  pendingFlows.delete(state);
}
