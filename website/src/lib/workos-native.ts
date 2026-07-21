/**
 * workos-native.ts — WorkOS configuration for the NATIVE (public) client.
 *
 * This module is intentionally separate from workos.ts (the web/confidential client).
 * The native client has NO client_secret — never import WORKOS_API_KEY or
 * WORKOS_COOKIE_PASSWORD from here.
 *
 * The workos singleton from workos.ts is reused for server-side SDK calls
 * (getAuthorizationUrl) because the API key is only needed to call WorkOS's
 * server-side management API — it is not sent to or used by the native client.
 * The native client ID is passed explicitly in each call below.
 */

// Re-export the shared WorkOS singleton (initialised in workos.ts with the API key).
// The native routes use it only for getAuthorizationUrl — a server-side SDK call.
export { workos } from "./workos";

const nativeClientId           = import.meta.env.WORKOS_NATIVE_CLIENT_ID as string | undefined;
const desktopCallbackUri       = import.meta.env.WORKOS_NATIVE_DESKTOP_CALLBACK_URI as string | undefined;

if (!nativeClientId) {
  throw new Error(
    "[workos-native] Missing env var WORKOS_NATIVE_CLIENT_ID. " +
    "Add it to website/.env — get the value from the WorkOS dashboard " +
    "under the native/public application entry."
  );
}

if (!desktopCallbackUri) {
  throw new Error(
    "[workos-native] Missing env var WORKOS_NATIVE_DESKTOP_CALLBACK_URI. " +
    "Add it to website/.env, e.g.: https://your-site.com/api/auth/desktop-callback. " +
    "This URI must be registered as an allowed redirect URI on the WorkOS native application."
  );
}

/** Client ID for the native/public WorkOS application. NOT the web app's client ID. */
export const WORKOS_NATIVE_CLIENT_ID: string     = nativeClientId;

/**
 * The redirect URI WorkOS sends the browser to after authentication.
 * Must be registered in the WorkOS dashboard on the NATIVE application entry
 * (not the web application entry).
 */
export const DESKTOP_CALLBACK_URI: string        = desktopCallbackUri;
