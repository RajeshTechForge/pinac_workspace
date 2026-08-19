export const prerender = false;

import type { APIRoute } from "astro";
import {
  workos,
  WORKOS_CLIENT_ID,
  WORKOS_COOKIE_PASSWORD,
  SESSION_COOKIE,
  OAUTH_STATE_COOKIE,
  POST_LOGIN_ROUTE,
  SIGNIN_ROUTE,
  baseCookieOptions,
} from "../../../lib/workos";

export const GET: APIRoute = async ({ url, redirect, cookies }) => {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = cookies.get(OAUTH_STATE_COOKIE)?.value;

  // Always clear the state cookie once consumed.
  const clearStateCookie = `${OAUTH_STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax${
    baseCookieOptions().secure ? "; Secure" : ""
  }; Max-Age=0`;

  if (!code || !state || !storedState || state !== storedState) {
    const res = redirect(`${SIGNIN_ROUTE}?error=STATE_MISMATCH`, 302);
    res.headers.append("Set-Cookie", clearStateCookie);
    return res;
  }

  try {
    const authRes = await workos.userManagement.authenticateWithCode({
      clientId: WORKOS_CLIENT_ID,
      code,
      session: {
        sealSession: true,
        cookiePassword: WORKOS_COOKIE_PASSWORD,
      },
    });

    const res = redirect(POST_LOGIN_ROUTE, 302);
    res.headers.append(
      "Set-Cookie",
      `${SESSION_COOKIE}=${authRes.sealedSession}; Path=/; HttpOnly; SameSite=Lax${
        baseCookieOptions().secure ? "; Secure" : ""
      }; Max-Age=40000000`,
    );
    res.headers.append("Set-Cookie", clearStateCookie);
    return res;
  } catch (err) {
    const res = redirect(`${SIGNIN_ROUTE}?error=OAUTH_FAILED`, 302);
    res.headers.append("Set-Cookie", clearStateCookie);
    return res;
  }
};
