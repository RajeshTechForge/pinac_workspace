import { defineMiddleware } from "astro:middleware";
import {
  workos,
  WORKOS_COOKIE_PASSWORD,
  SESSION_COOKIE,
  isProtectedRoute,
  SIGNIN_ROUTE,
  baseCookieOptions,
  toSafeUser,
  type SafeUser,
} from "./lib/workos";

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;
  const sealed = context.cookies.get(SESSION_COOKIE)?.value;

  let user: SafeUser | null = null;

  if (sealed) {
    try {
      const session = workos.userManagement.loadSealedSession({
        sessionData: sealed,
        cookiePassword: WORKOS_COOKIE_PASSWORD,
      });

      const authResult = await session.authenticate();

      if (authResult.authenticated && authResult.user) {
        user = toSafeUser(authResult.user);
      }

      // If the access token is expired, attempt a transparent refresh
      if (!authResult.authenticated && authResult.reason === "invalid_jwt") {
        try {
          const refreshResult = await session.refresh({
            cookiePassword: WORKOS_COOKIE_PASSWORD,
          });

          if (
            refreshResult.authenticated &&
            refreshResult.sealedSession &&
            refreshResult.user
          ) {
            const opts = baseCookieOptions();
            context.cookies.set(SESSION_COOKIE, refreshResult.sealedSession, {
              httpOnly: true,
              secure: opts.secure,
              sameSite: opts.sameSite,
              path: opts.path,
              maxAge: 40000000,
            });
            user = toSafeUser(refreshResult.user);
          }
        } catch {
          // Refresh failed — treat as logged-out for protected routes.
          user = null;
        }
      }
    } catch {
      user = null;
    }
  }

  context.locals.user = user;

  const protectedRoute = isProtectedRoute(pathname);

  if (protectedRoute && !user) {
    const redirectTo = encodeURIComponent(`${pathname}${search}`);
    return context.redirect(`${SIGNIN_ROUTE}?redirect_to=${redirectTo}`);
  }

  return next();
});
