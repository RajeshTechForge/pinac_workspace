export const prerender = false;

import type { APIRoute } from "astro";
import {
  createSupabaseServerClient,
  SUPABASE_URL,
  APP_BASE_URL,
  DESKTOP_CALLBACK_URI,
  ALLOWED_OAUTH_PROVIDERS,
  type AllowedProvider,
} from "../../../../lib/supabase";

interface ApiError {
  code: "INVALID_PROVIDER" | "API_ERROR";
  message: string;
}

export const GET: APIRoute = async (context) => {
  const { params, redirect, cookies, request, url } = context;
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
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const allowed = provider as AllowedProvider;
  const isDesktop =
    url.searchParams.get("desktop") === "1" ||
    url.searchParams.get("desktop") === "true";
  const codeChallenge = url.searchParams.get("code_challenge");
  const state = url.searchParams.get("state") ?? "";

  // If initiated from desktop flow with PKCE code_challenge:
  if (isDesktop && codeChallenge) {
    const oauthParams = new URLSearchParams({
      provider: allowed,
      code_challenge: codeChallenge,
      code_challenge_method: "s256",
      redirect_to: DESKTOP_CALLBACK_URI,
      state,
    });
    return redirect(
      `${SUPABASE_URL}/auth/v1/authorize?${oauthParams.toString()}`,
      302,
    );
  }

  // Standard web browser OAuth:
  const redirectUri = `${APP_BASE_URL}/api/auth/callback`;

  try {
    const supabase = createSupabaseServerClient(cookies, request);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: allowed,
      options: {
        redirectTo: redirectUri,
      },
    });

    if (error || !data.url) {
      console.error(
        `[api/auth/social/${provider}] Supabase OAuth error:`,
        error?.message,
      );
      return new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "API_ERROR",
            message: "Could not start OAuth flow.",
          },
        } satisfies { ok: false; error: ApiError }),
        { status: 502, headers: { "content-type": "application/json" } },
      );
    }

    return redirect(data.url, 302);
  } catch (err) {
    console.error(`[api/auth/social/${provider}] Unexpected error:`, err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: {
          code: "API_ERROR",
          message: "Could not start OAuth flow.",
        },
      } satisfies { ok: false; error: ApiError }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }
};
