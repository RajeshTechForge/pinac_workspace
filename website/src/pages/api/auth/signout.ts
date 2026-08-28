export const prerender = false;

import type { APIRoute } from "astro";
import {
  createSupabaseServerClient,
  SIGNIN_ROUTE,
} from "../../../lib/supabase";

interface SignoutResponse {
  ok: boolean;
  redirectTo: string;
}

export const POST: APIRoute = async ({ cookies, request }) => {
  try {
    const supabase = createSupabaseServerClient(cookies, request);
    await supabase.auth.signOut();
  } catch (err) {
    console.error("[api/auth/signout] Error during signOut:", err);
  }

  return new Response(
    JSON.stringify({
      ok: true,
      redirectTo: SIGNIN_ROUTE,
    } satisfies SignoutResponse),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
};
