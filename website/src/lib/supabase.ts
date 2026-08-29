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
export const DESKTOP_CALLBACK_URI = `${APP_BASE_URL}/auth/desktop-callback`;

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

// ---------------------------------------------------------------------------
// Desktop PKCE Transfer Token Helpers (for Email/Password desktop auth)
// ---------------------------------------------------------------------------

async function getSigningKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(supabaseAnonKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array<ArrayBuffer> {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function createDesktopTransferCode(payload: {
  code_challenge: string;
  access_token: string;
  refresh_token: string;
  user: SafeUser;
}): Promise<string> {
  const enc = new TextEncoder();
  const dataStr = JSON.stringify({
    ...payload,
    exp: Date.now() + 120_000, // 2 minutes validity
  });
  const dataBytes = enc.encode(dataStr);
  const dataB64 = base64UrlEncode(dataBytes);

  const key = await getSigningKey();
  const signatureBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(dataB64)),
  );
  const sigB64 = base64UrlEncode(signatureBytes);

  return `pkce_transfer.${dataB64}.${sigB64}`;
}

export async function verifyDesktopTransferCode(
  code: string,
  codeVerifier: string,
): Promise<{
  access_token: string;
  refresh_token: string;
  user: SafeUser;
} | null> {
  if (!code.startsWith("pkce_transfer.")) return null;

  const parts = code.split(".");
  if (parts.length !== 3) return null;

  const [, dataB64, sigB64] = parts;
  const enc = new TextEncoder();

  try {
    // 1. Verify HMAC Signature
    const key = await getSigningKey();
    const sigBytes = base64UrlDecode(sigB64);
    const isValidSig = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      enc.encode(dataB64),
    );
    if (!isValidSig) return null;

    // 2. Decode payload
    const dataBytes = base64UrlDecode(dataB64);
    const dataStr = new TextDecoder().decode(dataBytes);
    const payload = JSON.parse(dataStr) as {
      code_challenge: string;
      access_token: string;
      refresh_token: string;
      user: SafeUser;
      exp: number;
    };

    // 3. Verify expiry
    if (Date.now() > payload.exp) return null;

    // 4. Verify code_verifier against code_challenge (RFC 7636 S256)
    const verifierBytes = enc.encode(codeVerifier);
    const hashBuffer = await crypto.subtle.digest("SHA-256", verifierBytes);
    const computedChallenge = base64UrlEncode(new Uint8Array(hashBuffer));

    if (computedChallenge !== payload.code_challenge) return null;

    return {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      user: payload.user,
    };
  } catch (err) {
    console.error("[supabase.ts] verifyDesktopTransferCode error:", err);
    return null;
  }
}
