/**
 * desktop-callback.ts — WorkOS redirect target for the native-client PKCE flow.
 * ISOLATION: No web session cookies are read or written.  The SESSION_COOKIE
 * and OAUTH_STATE_COOKIE from workos.ts are never touched here.
 */

export const prerender = false;

import type { APIRoute } from "astro";

// ---------------------------------------------------------------------------
// Confirmation page HTML
// ---------------------------------------------------------------------------

function confirmationPage(deepLinkUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="2;url=${deepLinkUrl}">
  <title>Signing you in — Pinac</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #0f0f11;
      color: #e8e8ec;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100dvh;
      margin: 0;
      padding: 24px;
      text-align: center;
    }
    .card {
      background: #1a1a1f;
      border: 1px solid #2a2a32;
      border-radius: 16px;
      padding: 40px 48px;
      max-width: 440px;
      width: 100%;
    }
    .icon {
      width: 56px; height: 56px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 24px;
      font-size: 28px;
    }
    h1 { font-size: 1.4rem; font-weight: 600; margin: 0 0 12px; }
    p  { color: #9ca3af; line-height: 1.6; margin: 0 0 24px; font-size: 0.95rem; }
    .spinner {
      width: 28px; height: 28px;
      border: 3px solid #2a2a32;
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .open-link {
      display: inline-block;
      margin-top: 8px;
      color: #818cf8;
      font-size: 0.88rem;
      text-decoration: none;
    }
    .open-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h1>You're signed in!</h1>
    <div class="spinner"></div>
    <p>Returning you to Pinac Workspace&hellip;<br>
       If the app doesn't open automatically,
       <a class="open-link" href="${deepLinkUrl}">click here</a>.</p>
  </div>
  <script>
    // Belt-and-suspenders: try opening the deep link immediately via JS,
    // in addition to the meta-refresh above.
    try { window.location.href = ${JSON.stringify(deepLinkUrl)}; } catch {}
  </script>
</body>
</html>`;
}

/** Renders a plain error page without touching the app layout. */
function errorPage(status: number, title: string, detail: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — Pinac</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 520px; margin: 80px auto;
           padding: 0 24px; color: #1a1a1a; }
    h1   { font-size: 1.5rem; color: #b91c1c; }
    p    { line-height: 1.6; color: #555; }
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

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export const GET: APIRoute = ({ url }) => {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // WorkOS can also send `error` and `error_description` on failure.
  const oauthError = url.searchParams.get("error");
  const oauthErrorDesc = url.searchParams.get("error_description");

  if (oauthError) {
    console.error(
      `[desktop-callback] WorkOS returned an error: ${oauthError} — ${oauthErrorDesc ?? ""}`,
    );
    return errorPage(
      400,
      "Authentication Failed",
      `WorkOS reported an error: <strong>${oauthError}</strong>. ` +
        (oauthErrorDesc ? `Details: ${oauthErrorDesc}.` : ""),
    );
  }

  if (!code || !state) {
    return errorPage(
      400,
      "Missing Parameters",
      "The callback URL is missing the required <code>code</code> or <code>state</code> " +
        "parameter. This may indicate a misconfigured redirect URI in the WorkOS dashboard.",
    );
  }

  // Build the deep link URL that hands the code back to the desktop app.
  // The desktop app's deepLinkHandler.ts will:
  //   1. Validate state against the in-memory pending flow.
  //   2. Exchange code + code_verifier for tokens.
  const deepLinkUrl = `pinac://auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;

  // Render the confirmation page with both a meta-refresh and a JS redirect
  // to the deep link.  The OS will intercept the pinac:// scheme and hand
  // control back to the Pinac Workspace desktop app.
  return new Response(confirmationPage(deepLinkUrl), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Belt-and-suspenders: also attempt the redirect at the HTTP layer.
      // Some browsers honour this; others (Firefox) require user gesture for
      // custom-scheme navigation — the JS fallback handles those.
      Location: deepLinkUrl,
    },
  });
};
