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
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
} from "./pkce";

const WEBSITE_BASE_URL = "https://pinac.rajeshmondal.com";

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

  const loginUrl = new URL(`${WEBSITE_BASE_URL}/desktop-login`);
  loginUrl.searchParams.set("code_challenge", codeChallenge);
  loginUrl.searchParams.set("code_challenge_method", "S256");
  loginUrl.searchParams.set("state", state);

  await openUrl(loginUrl.toString());
}

export function getPendingFlow(state: string): PendingFlow | undefined {
  const flow = pendingFlows.get(state);
  if (!flow) return undefined;
  if (flow.expiresAt < Date.now()) {
    pendingFlows.delete(state);
    return undefined;
  }
  return flow;
}

export function clearPendingFlow(state: string): void {
  pendingFlows.delete(state);
}
