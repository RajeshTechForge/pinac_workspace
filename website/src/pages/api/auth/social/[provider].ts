export const prerender = false;

import type { APIRoute } from "astro";
import {
  workos,
  WORKOS_CLIENT_ID,
  APP_BASE_URL,
  OAUTH_STATE_COOKIE,
  ALLOWED_OAUTH_PROVIDERS,
  baseCookieOptions,
  type AllowedProvider,
} from "../../../../lib/workos";

interface ApiError {
  code: "INVALID_PROVIDER" | "API_ERROR";
  message: string;
}

const PROVIDER_TO_STRING: Record<AllowedProvider, string> = {
  google: "GoogleOAuth",
  github: "GitHubOAuth",
};

function randomState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const arr = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return arr.join("");
}

export const GET: APIRoute = async ({ params, redirect }) => {
  const provider = params.provider;
  if (
    typeof provider !== "string" ||
    !ALLOWED_OAUTH_PROVIDERS.includes(provider as AllowedProvider)
  ) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: { code: "INVALID_PROVIDER", message: "Unsupported provider." },
      } satisfies { ok: false; error: ApiError }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const allowed = provider as AllowedProvider;
  const state = randomState();
  const redirectUri = `${APP_BASE_URL}/api/auth/callback`;

  let authUrl: string;
  try {
    authUrl = workos.userManagement.getAuthorizationUrl({
      provider: PROVIDER_TO_STRING[allowed],
      clientId: WORKOS_CLIENT_ID,
      redirectUri,
      state,
    });
  } catch (err) {
    const e = err as { message?: string };
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: "API_ERROR",
          message: "Could not start OAuth flow.",
        },
      } satisfies { ok: false; error: ApiError }),
      { status: 502, headers: { "content-type": "application/json" } }
    );
  }

  const res = redirect(authUrl, 302);
  const opts = baseCookieOptions();
  res.headers.append(
    "Set-Cookie",
    `${OAUTH_STATE_COOKIE}=${state}; Path=/; HttpOnly; SameSite=Lax${
      opts.secure ? "; Secure" : ""
    }; Max-Age=600`
  );
  return res;
};
