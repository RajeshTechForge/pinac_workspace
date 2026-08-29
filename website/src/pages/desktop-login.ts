/**
 * desktop-login.ts — PKCE relay route for the Pinac-Workspace desktop app.
 *
 * SSO / Active Session Handling:
 * If the user is ALREADY logged in on the browser, it seamlessly generates a PKCE
 * transfer code from their existing session and redirects to desktop-callback immediately.
 *
 * If not logged in:
 * - If a specific social provider is requested (e.g. ?provider=github), forwards directly to OAuth.
 * - Otherwise, routes to the branded Sign-In page with desktop parameters attached.
 */

export const prerender = false;

import type { APIRoute, APIContext } from "astro";
import {
  createSupabaseServerClient,
  createDesktopTransferCode,
  toSafeUser,
  SUPABASE_URL,
  DESKTOP_CALLBACK_URI,
  ALLOWED_OAUTH_PROVIDERS,
  type AllowedProvider,
} from "../lib/supabase";

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Redirects to the branded /auth/desktop-callback page with error details. */
function errorRedirect(
  redirect: APIContext["redirect"],
  title: string,
  detail: string,
): Response {
  const params = new URLSearchParams({
    error: title,
    error_description: detail.replace(/<[^>]*>?/gm, ""), // strip any raw HTML tags
  });
  return redirect(`/auth/desktop-callback?${params.toString()}`, 302);
}

const CODE_CHALLENGE_RE = /^[A-Za-z0-9\-._~]{43,128}$/;
const STATE_RE = /^[A-Za-z0-9\-._~+/]{40,128}$/;

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export const GET: APIRoute = async (context) => {
  const { url, redirect, cookies, request } = context;
  const codeChallenge = url.searchParams.get("code_challenge");
  const codeChallengeMethod = url.searchParams.get("code_challenge_method");
  const state = url.searchParams.get("state");
  const requestedProvider = url.searchParams.get("provider");

  // ── Param presence ────────────────────────────────────────────────────────
  if (!codeChallenge || !codeChallengeMethod || !state) {
    return errorRedirect(
      redirect,
      "Missing Parameters",
      "The desktop login link is missing required parameters " +
        "(code_challenge, code_challenge_method, state). " +
        "This link must be opened by the Pinac desktop app, not manually.",
    );
  }

  // ── code_challenge_method ─────────────────────────────────────────────────
  // Only S256 is accepted — plain is not allowed per RFC 7636 §4.
  if (codeChallengeMethod !== "S256") {
    return errorRedirect(
      redirect,
      "Unsupported Challenge Method",
      `code_challenge_method must be S256. Received: ${codeChallengeMethod}.`,
    );
  }

  // ── code_challenge format ─────────────────────────────────────────────────
  if (!CODE_CHALLENGE_RE.test(codeChallenge)) {
    return errorRedirect(
      redirect,
      "Malformed code_challenge",
      "The code_challenge parameter has an unexpected format. " +
        "It must be a BASE64URL-encoded SHA-256 hash (43–128 URL-safe characters).",
    );
  }

  // ── state format ──────────────────────────────────────────────────────────
  if (!STATE_RE.test(state)) {
    return errorRedirect(
      redirect,
      "Malformed state",
      "The state parameter has an unexpected format.",
    );
  }

  // ── Single Sign-On: Check if user already has an active session in browser ─
  try {
    const supabase = createSupabaseServerClient(cookies, request);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user && session?.access_token) {
      const transferCode = await createDesktopTransferCode({
        code_challenge: codeChallenge,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        user: toSafeUser(session.user),
      });

      const desktopCallback = `${DESKTOP_CALLBACK_URI}?code=${encodeURIComponent(transferCode)}&state=${encodeURIComponent(state)}`;
      return redirect(desktopCallback, 302);
    }
  } catch (err) {
    console.error("[desktop-login] Session check error:", err);
  }

  // ── Direct OAuth provider requested ───────────────────────────────────────
  if (
    typeof requestedProvider === "string" &&
    ALLOWED_OAUTH_PROVIDERS.includes(requestedProvider as AllowedProvider)
  ) {
    const params = new URLSearchParams({
      provider: requestedProvider,
      code_challenge: codeChallenge,
      code_challenge_method: "s256",
      redirect_to: DESKTOP_CALLBACK_URI,
      state,
    });
    return redirect(
      `${SUPABASE_URL}/auth/v1/authorize?${params.toString()}`,
      302,
    );
  }

  // ── Default: Route to the branded Sign-In page with desktop parameters ────
  const signinParams = new URLSearchParams({
    desktop: "1",
    code_challenge: codeChallenge,
    state,
  });

  return redirect(`/auth/sign-in?${signinParams.toString()}`, 302);
};
