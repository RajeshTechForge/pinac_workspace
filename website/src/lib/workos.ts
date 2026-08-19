import { WorkOS } from "@workos-inc/node";

const apiKey = import.meta.env.WORKOS_API_KEY;
const clientId = import.meta.env.WORKOS_CLIENT_ID;
const cookiePassword = import.meta.env.COOKIE_PASSWORD;

if (!apiKey) {
  throw new Error("Missing env var WORKOS_API_KEY");
}
if (!clientId) {
  throw new Error("Missing env var WORKOS_CLIENT_ID");
}
if (!cookiePassword || cookiePassword.length < 32) {
  throw new Error(
    "Missing or too-short env var COOKIE_PASSWORD (must be >= 32 chars)",
  );
}

/**
 * Singleton WorkOS client. Server-only — never import this from client code.
 */
export const workos = new WorkOS(apiKey, {
  clientId,
});

export const WORKOS_COOKIE_PASSWORD = cookiePassword;
export const WORKOS_CLIENT_ID = clientId;

/** Name of the sealed session cookie (matches WorkOS default). */
export const SESSION_COOKIE = "wos-session";
/** Name of the short-lived OAuth state cookie (CSRF). */
export const OAUTH_STATE_COOKIE = "oauth_state";

/** Routes configurable via env, with sensible dev defaults. */
export const APP_BASE_URL = import.meta.env.APP_BASE_URL;
export const SIGNIN_ROUTE = "/auth/sign-in";
export const POST_LOGIN_ROUTE = import.meta.env.POST_LOGIN_ROUTE;

/** Configuration for the public client */
export const DESKTOP_CALLBACK_URI = APP_BASE_URL + "/api/auth/desktop-callback";

/** Routes that require an authenticated session. */
export const PROTECTED_ROUTE_PREFIXES = ["/dashboard", "/account"];

export const ALLOWED_OAUTH_PROVIDERS = ["google", "github"] as const;
export type AllowedProvider = (typeof ALLOWED_OAUTH_PROVIDERS)[number];

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isSecureContext(): boolean {
  // Treat https or explicit override as secure. In local dev over http,
  // secure cookies won't be set by the browser unless overridden.
  if (import.meta.env.WORKOS_COOKIE_SECURE === "false") return false;
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

export function toSafeUser(u: {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  profilePictureUrl?: string | null;
}): SafeUser {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName ?? null,
    lastName: u.lastName ?? null,
    profilePictureUrl: u.profilePictureUrl ?? null,
  };
}
