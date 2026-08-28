export const prerender = false;

import type { APIRoute } from "astro";
import {
  createSupabaseServerClient,
  POST_LOGIN_ROUTE,
  SIGNIN_ROUTE,
} from "../../../lib/supabase";

export const GET: APIRoute = async (context) => {
  const { url, redirect, cookies, request } = context;

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    console.error(
      `[api/auth/callback] OAuth callback returned error: ${error} - ${errorDescription ?? ""}`,
    );
    return redirect(`${SIGNIN_ROUTE}?error=OAUTH_FAILED`, 302);
  }

  if (!code) {
    return redirect(`${SIGNIN_ROUTE}?error=OAUTH_FAILED`, 302);
  }

  try {
    const supabase = createSupabaseServerClient(cookies, request);
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error(
        "[api/auth/callback] Supabase exchangeCodeForSession failed:",
        exchangeError.message,
      );
      return redirect(`${SIGNIN_ROUTE}?error=OAUTH_FAILED`, 302);
    }

    return redirect(POST_LOGIN_ROUTE, 302);
  } catch (err) {
    console.error("[api/auth/callback] Unexpected error:", err);
    return redirect(`${SIGNIN_ROUTE}?error=OAUTH_FAILED`, 302);
  }
};
