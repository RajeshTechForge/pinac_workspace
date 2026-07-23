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

import { openUrl } from "@tauri-apps/plugin-opener";
import { generateCodeVerifier, generateCodeChallenge, generateState } from "./pkce";


interface PendingFlow {
  readonly codeVerifier: string;
  readonly expiresAt: number;
}

const pendingFlows = new Map<string, PendingFlow>();
const FLOW_TTL_MS = 10 * 60 * 1000; // 10 minutes

function pruneExpiredFlows(): void {
  const now = Date.now();
  for (const [state, flow] of pendingFlows) {
    if (flow.expiresAt < now) {
      pendingFlows.delete(state);
    }
  }
}

// PUBLIC API
export async function startLogin(): Promise<void> {
  const websiteBaseUrl = import.meta.env.VITE_WEBSITE_BASE_URL as string | undefined;
  if (!websiteBaseUrl) {
    throw new Error(
      "[auth] VITE_WEBSITE_BASE_URL is not set. Add it to desktop/.env."
    );
  }

  const nativeClientId = import.meta.env.VITE_WORKOS_CLIENT_ID as string | undefined;
  if (!nativeClientId) {
    throw new Error(
      "[auth] VITE_WORKOS_CLIENT_ID is not set. Add it to desktop/.env."
    );
  }

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

  const loginUrl = new URL(`${websiteBaseUrl}/desktop-login`);
  loginUrl.searchParams.set("code_challenge", codeChallenge);
  loginUrl.searchParams.set("code_challenge_method", "S256");
  loginUrl.searchParams.set("state", state);
  loginUrl.searchParams.set("client_id", nativeClientId);
  
  await openUrl(loginUrl.toString());
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
