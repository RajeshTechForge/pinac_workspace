/**
 * desktop-login.ts — PKCE relay route for the Pinac-Workspace desktop app.
 *
 * The `redirectUri` in getAuthorizationUrl points to /api/auth/desktop-callback,
 * which hands the code back to the desktop app via the pinac:// scheme.
 */

export const prerender = false;

import type { APIRoute } from "astro";
import { workos, WORKOS_CLIENT_ID, DESKTOP_CALLBACK_URI } from "../lib/workos";

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

// RFC 7636 §4.2: code_challenge is BASE64URL, 43–128 chars of [A-Za-z0-9\-._~]
const CODE_CHALLENGE_RE = /^[A-Za-z0-9\-._~]{43,128}$/;
// state: we accept 40–128 hex/base64url chars (desktop sends 64 hex chars)
const STATE_RE = /^[A-Za-z0-9\-._~+/]{40,128}$/;

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export const GET: APIRoute = async ({ url, redirect }) => {
  const codeChallenge       = url.searchParams.get("code_challenge");
  const codeChallengeMethod = url.searchParams.get("code_challenge_method");
  const state               = url.searchParams.get("state");
  const clientId            = url.searchParams.get("client_id");

  // ── Param presence ────────────────────────────────────────────────────────
  if (!codeChallenge || !codeChallengeMethod || !state || !clientId) {
    return errorPage(
      400,
      "Missing Parameters",
      "The desktop login link is missing required parameters " +
      "(<code>code_challenge</code>, <code>code_challenge_method</code>, " +
      "<code>state</code>, <code>client_id</code>). " +
      "This link must be opened by the Pinac desktop app, not manually."
    );
  }

  // ── code_challenge_method ─────────────────────────────────────────────────
  // Only S256 is accepted — plain is not allowed per RFC 7636 §4.
  if (codeChallengeMethod !== "S256") {
    return errorPage(
      400,
      "Unsupported Challenge Method",
      `<code>code_challenge_method</code> must be <code>S256</code>. ` +
      `Received: <code>${codeChallengeMethod}</code>.`
    );
  }

  // ── code_challenge format ─────────────────────────────────────────────────
  if (!CODE_CHALLENGE_RE.test(codeChallenge)) {
    return errorPage(
      400,
      "Malformed code_challenge",
      "The <code>code_challenge</code> parameter has an unexpected format. " +
      "It must be a BASE64URL-encoded SHA-256 hash (43–128 URL-safe characters)."
    );
  }

  // ── state format ──────────────────────────────────────────────────────────
  if (!STATE_RE.test(state)) {
    return errorPage(
      400,
      "Malformed state",
      "The <code>state</code> parameter has an unexpected format."
    );
  }

  // ── client_id must match the registered native client ID ─────────────────
  // This prevents a malicious page from using this relay route with a
  // different client ID to phish WorkOS auth flows.
  if (clientId !== WORKOS_CLIENT_ID) {
    return errorPage(
      400,
      "Unknown Client",
      "The <code>client_id</code> does not match the registered desktop application."
    );
  }

  // ── Build the WorkOS authorization URL ───────────────────────────────────
  let authUrl: string;
  try {
    // getAuthorizationUrl accepts codeChallenge + codeChallengeMethod directly
    // when passed as options. The desktop app already generated these; the SDK
    // does not need to (and must not) regenerate them.
    // Ref: WorkOS Node SDK docs — getAuthorizationUrl options (July 2025).
    authUrl = workos.userManagement.getAuthorizationUrl({
      clientId:            WORKOS_CLIENT_ID,
      redirectUri:         DESKTOP_CALLBACK_URI,
      state,
      // PKCE params forwarded verbatim from the desktop app:
      codeChallenge,
      codeChallengeMethod: "S256",
      // "authkit" instructs WorkOS to render its hosted AuthKit sign-in UI,
      // which lets the user choose email/password, Google, or GitHub — exactly
      // the same multi-method experience as the web login. One of provider /
      // connectionId / organizationId is mandatory; this is the correct value
      // for a generic password + social sign-in page.
      provider: "authkit",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[desktop-login] getAuthorizationUrl failed:", message);
    return errorPage(
      502,
      "Authorization Error",
      "Could not start the sign-in process. Please try again in a moment."
    );
  }

  // Redirect into the WorkOS-hosted custom-UI sign-in flow.
  // The user will see the same sign-in page as on the web.
  return redirect(authUrl, 302);
};
