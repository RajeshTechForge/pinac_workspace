import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AstroCookies } from "astro";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env var SUPABASE_URL");
}
if (!supabaseAnonKey) {
  throw new Error("Missing env var SUPABASE_ANON_KEY");
}

export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;

/** Routes configurable via env, with sensible dev defaults. */
export const APP_BASE_URL: string =
  import.meta.env.APP_BASE_URL ?? "http://localhost:4321";
export const SIGNIN_ROUTE = "/auth/sign-in";
export const POST_LOGIN_ROUTE: string =
  import.meta.env.POST_LOGIN_ROUTE ?? "/dashboard";

/** Configuration for the native desktop client callback URI */
export const DESKTOP_CALLBACK_URI = `${APP_BASE_URL}/api/auth/desktop-callback`;

/** Routes that require an authenticated session. */
export const PROTECTED_ROUTE_PREFIXES: readonly string[] = [
  "/dashboard",
  "/account",
  "/profile",
];

export const ALLOWED_OAUTH_PROVIDERS = ["google", "github"] as const;
export type AllowedProvider = (typeof ALLOWED_OAUTH_PROVIDERS)[number];

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isSecureContext(): boolean {
  if (import.meta.env.COOKIE_SECURE === "false") return false;
  return true;
}

export function baseCookieOptions(): {
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
} {
  return {
    path: "/",
    httpOnly: true,
    secure: isSecureContext(),
    sameSite: "lax",
  };
}

export type SafeUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profilePictureUrl: string | null;
};

export function toSafeUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): SafeUser {
  const meta = user.user_metadata ?? {};
  const firstName =
    (typeof meta.first_name === "string" && meta.first_name.trim()) ||
    (typeof meta.firstName === "string" && meta.firstName.trim()) ||
    (typeof meta.full_name === "string"
      ? meta.full_name.trim().split(/\s+/)[0]
      : null) ||
    (typeof meta.name === "string" ? meta.name.trim().split(/\s+/)[0] : null) ||
    null;

  const lastName =
    (typeof meta.last_name === "string" && meta.last_name.trim()) ||
    (typeof meta.lastName === "string" && meta.lastName.trim()) ||
    (typeof meta.full_name === "string" &&
    meta.full_name.trim().split(/\s+/).length > 1
      ? meta.full_name.trim().split(/\s+/).slice(1).join(" ")
      : null) ||
    (typeof meta.name === "string" && meta.name.trim().split(/\s+/).length > 1
      ? meta.name.trim().split(/\s+/).slice(1).join(" ")
      : null) ||
    null;

  const profilePictureUrl =
    (typeof meta.avatar_url === "string" && meta.avatar_url.trim()) ||
    (typeof meta.picture === "string" && meta.picture.trim()) ||
    null;

  return {
    id: user.id,
    email: user.email ?? "",
    firstName,
    lastName,
    profilePictureUrl,
  };
}

/**
 * Creates an SSR-compatible Supabase client using Astro's cookie manager.
 * Automatically synchronizes session tokens and chunks across request cookies.
 */
export function createSupabaseServerClient(
  cookiesOrContext: AstroCookies | { cookies: AstroCookies; request?: Request },
  maybeRequest?: Request,
): ReturnType<typeof createServerClient> {
  let cookies: AstroCookies;
  let request: Request | undefined;

  if (
    "cookies" in cookiesOrContext &&
    typeof cookiesOrContext.cookies === "object"
  ) {
    cookies = cookiesOrContext.cookies;
    request = cookiesOrContext.request;
  } else {
    cookies = cookiesOrContext as AstroCookies;
    request = maybeRequest;
  }

  const cookieHeader = request?.headers.get("Cookie") ?? "";

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(cookieHeader);
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, {
            ...options,
            path: options?.path ?? "/",
            sameSite: "lax",
            secure: isSecureContext(),
          });
        });
      },
    },
  });
}

/**
 * Creates a service-role Supabase client for administrative/server-only operations.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Missing env var SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
