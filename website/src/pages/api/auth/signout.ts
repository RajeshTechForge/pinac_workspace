export const prerender = false;

import type { APIRoute } from "astro";
import {
  workos,
  WORKOS_COOKIE_PASSWORD,
  SESSION_COOKIE,
  SIGNIN_ROUTE,
  baseCookieOptions,
} from "../../../lib/workos";

interface SignoutResponse {
  ok: boolean;
  redirectTo: string;
}

export const POST: APIRoute = async ({ cookies }) => {
  const sealed = cookies.get(SESSION_COOKIE)?.value;

  if (sealed) {
    try {
      const session = workos.userManagement.loadSealedSession({
        sessionData: sealed,
        cookiePassword: WORKOS_COOKIE_PASSWORD,
      });

      // Get logout URL from WorkOS to end the session server-side
      const logOutUrl = await session.getLogoutUrl();

      const opts = baseCookieOptions();
      const res = new Response(
        JSON.stringify({ ok: true, redirectTo: logOutUrl } satisfies SignoutResponse),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      );
      res.headers.append(
        "Set-Cookie",
        `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax${
          opts.secure ? "; Secure" : ""
        }; Max-Age=0`
      );
      return res;
    } catch {
      // Swallow — invalid/already-expired session. Still clear the cookie.
    }
  }

  const opts = baseCookieOptions();
  const res = new Response(
    JSON.stringify({ ok: true, redirectTo: SIGNIN_ROUTE } satisfies SignoutResponse),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    }
  );
  res.headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax${
      opts.secure ? "; Secure" : ""
    }; Max-Age=0`
  );
  return res;
};
