export const prerender = false;

import type { APIRoute } from "astro";
import {
  createSupabaseServerClient,
  SIGNIN_ROUTE,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
} from "../../../lib/supabase";

const TAURI_ORIGINS = new Set([
  "http://localhost:1420", // Dev mode
  "tauri://localhost", // macOS/Linux
  "https://tauri.localhost", // Windows (WebView2)
]);

function resolveOrigin(request: Request): string | null {
  const origin = request.headers.get("Origin");
  return origin !== null && TAURI_ORIGINS.has(origin) ? origin : null;
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "7200",
    Vary: "Origin",
  };
}

interface SignoutResponse {
  ok: boolean;
  redirectTo: string;
}

export const OPTIONS: APIRoute = ({ request }) => {
  const origin = resolveOrigin(request);
  if (origin === null) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
};

export const POST: APIRoute = async ({ cookies, request }) => {
  const origin = resolveOrigin(request);

  // Check if Authorization header have Bearer token
  const authHeader = request.headers.get("Authorization");
  const isBearer =
    typeof authHeader === "string" &&
    authHeader.toLowerCase().startsWith("bearer ");

  if (isBearer) {
    const accessToken = authHeader.slice(7).trim();
    if (accessToken) {
      try {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${accessToken}`,
          },
        });
      } catch (err) {
        console.error(
          "[api/auth/signout] Error during desktop token signOut:",
          err,
        );
      }
    }
  } else {
    // Clear cookie-based sessions for browser clients
    try {
      const supabase = createSupabaseServerClient(cookies, request);
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[api/auth/signout] Error during cookie signOut:", err);
    }
  }

  const responseHeaders: Record<string, string> = {
    "content-type": "application/json",
    ...(origin ? corsHeaders(origin) : {}),
  };

  return new Response(
    JSON.stringify({
      ok: true,
      redirectTo: SIGNIN_ROUTE,
    } satisfies SignoutResponse),
    {
      status: 200,
      headers: responseHeaders,
    },
  );
};
