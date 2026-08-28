import { defineMiddleware } from "astro:middleware";
import {
  createSupabaseServerClient,
  isProtectedRoute,
  SIGNIN_ROUTE,
  toSafeUser,
  type SafeUser,
} from "./lib/supabase";

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;
  const supabase = createSupabaseServerClient(context.cookies, context.request);

  let user: SafeUser | null = null;

  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) {
      user = toSafeUser(data.user);
    }
  } catch {
    user = null;
  }

  context.locals.user = user;

  const protectedRoute = isProtectedRoute(pathname);

  if (protectedRoute && !user) {
    const redirectTo = encodeURIComponent(`${pathname}${search}`);
    return context.redirect(`${SIGNIN_ROUTE}?redirect_to=${redirectTo}`);
  }

  return next();
});
