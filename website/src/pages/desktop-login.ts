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

import type { APIRoute } from "astro";
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

/** Renders a plain HTML error page (no layout dependency). */
function errorPage(status: number, title: string, detail: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — Pinac</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 520px; margin: 80px auto; padding: 0 24px; color: #1a1a1a; }
    h1   { font-size: 1.5rem; color: #b91c1c; }
    p    { line-height: 1.6; color: #555; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>${detail}</p>
  <p>Please return to Pinac Workspace and try signing in again.</p>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
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
    return errorPage(
      400,
      "Missing Parameters",
      "The desktop login link is missing required parameters " +
        "(<code>code_challenge</code>, <code>code_challenge_method</code>, " +
        "<code>state</code>). " +
        "This link must be opened by the Pinac desktop app, not manually.",
    );
  }

  // ── code_challenge_method ─────────────────────────────────────────────────
  // Only S256 is accepted — plain is not allowed per RFC 7636 §4.
  if (codeChallengeMethod !== "S256") {
    return errorPage(
      400,
      "Unsupported Challenge Method",
      `<code>code_challenge_method</code> must be <code>S256</code>. ` +
        `Received: <code>${codeChallengeMethod}</code>.`,
    );
  }

  // ── code_challenge format ─────────────────────────────────────────────────
  if (!CODE_CHALLENGE_RE.test(codeChallenge)) {
    return errorPage(
      400,
      "Malformed code_challenge",
      "The <code>code_challenge</code> parameter has an unexpected format. " +
        "It must be a BASE64URL-encoded SHA-256 hash (43–128 URL-safe characters).",
    );
  }

  // ── state format ──────────────────────────────────────────────────────────
  if (!STATE_RE.test(state)) {
    return errorPage(
      400,
      "Malformed state",
      "The <code>state</code> parameter has an unexpected format.",
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
