/**
 * deepLinkHandler.ts — Receives and processes pinac:// deep-link callbacks.
 *
 * Registers two listeners (called once, at app startup via `initDeepLinkHandler`):
 *
 *  1. `onOpenUrl` from @tauri-apps/plugin-deep-link — fires on macOS when the OS
 *     opens a deep link while the app is already running (or on app launch with
 *     the URL as the first open event).
 *
 *  2. A Tauri event listener for "deep-link://new-url" — emitted by the Rust
 *     single-instance plugin callback (lib.rs) when Windows / Linux forward a
 *     second-process deep-link to the primary process.
 *
 * Both paths converge at `handleDeepLinkUrl()`, which:
 *  - Validates the URL scheme and path.
 *  - Extracts `code` and `state` query params.
 *  - Validates `state` against the in-memory pending flow (anti-CSRF).
 *  - Calls `exchangeCodeForTokens` with the stored `code_verifier`.
 *  - Stores the resulting tokens via `saveTokens`.
 *  - Clears the in-memory flow entry.
 *  - Emits `"auth:success"` or `"auth:error"` via the internal event bus
 *    so the UI layer can react without coupling to this module.
 */

import { onOpenUrl, getCurrent } from "@tauri-apps/plugin-deep-link";
import { listen } from "@tauri-apps/api/event";
import { getPendingFlow, clearPendingFlow } from "./authFlow";
import { exchangeCodeForTokens } from "./tokenExchange";
import { saveTokens } from "./secureStorage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Discriminated union of all deep-link auth failure reasons.
 * The UI layer matches on `.code` to show an appropriate message.
 */
export type DeepLinkAuthError =
  | { readonly code: "INVALID_URL";    readonly message: string }
  | { readonly code: "MISSING_PARAMS"; readonly message: string }
  | { readonly code: "NO_PENDING_FLOW";
      readonly message: string;
      /**
       * Present when the app was not running when the deep link fired (cold start).
       * The user needs to re-initiate login from within the app.
       */
      readonly coldStart?: true }
  | { readonly code: "STATE_MISMATCH"; readonly message: string }
  | { readonly code: "FLOW_EXPIRED";   readonly message: string }
  | { readonly code: "EXCHANGE_FAILED";
      readonly message: string;
      readonly kind: "INVALID_GRANT" | "EXPIRED_CODE" | "NETWORK" | "UNKNOWN" }
  | { readonly code: "STORAGE_ERROR";  readonly message: string };

/** Successful auth result surfaced to the UI. */
export interface AuthSuccessPayload {
  readonly userId: string;
  readonly userEmail: string;
}

// ---------------------------------------------------------------------------
// Internal event bus (lightweight — no external dep)
// ---------------------------------------------------------------------------

type AuthSuccessHandler = (payload: AuthSuccessPayload) => void;
type AuthErrorHandler   = (error: DeepLinkAuthError)    => void;

const successHandlers: Set<AuthSuccessHandler> = new Set();
const errorHandlers:   Set<AuthErrorHandler>   = new Set();

/** Subscribe to successful auth events. Returns an unsubscribe function. */
export function onAuthSuccess(handler: AuthSuccessHandler): () => void {
  successHandlers.add(handler);
  return () => successHandlers.delete(handler);
}

/** Subscribe to auth error events. Returns an unsubscribe function. */
export function onAuthError(handler: AuthErrorHandler): () => void {
  errorHandlers.add(handler);
  return () => errorHandlers.delete(handler);
}

function emitSuccess(payload: AuthSuccessPayload): void {
  successHandlers.forEach((h) => h(payload));
}

function emitError(error: DeepLinkAuthError): void {
  errorHandlers.forEach((h) => h(error));
}

// ---------------------------------------------------------------------------
// Core handler
// ---------------------------------------------------------------------------

/**
 * Processes a raw deep-link URL string received from either listener.
 *
 * This function is the security boundary for the inbound auth callback.
 * Every rejection path emits a typed error and returns early — never silently
 * succeeds or partially processes an invalid URL.
 */
async function handleDeepLinkUrl(rawUrl: string): Promise<void> {
  // Step 1: Parse and validate the URL structure.
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    emitError({ code: "INVALID_URL", message: `Cannot parse deep-link URL: "${rawUrl}"` });
    return;
  }

  if (parsed.protocol !== "pinac:") {
    emitError({
      code: "INVALID_URL",
      message: `Unexpected deep-link scheme: "${parsed.protocol}". Expected "pinac:".`,
    });
    return;
  }

  // Normalise: URL("pinac://auth/callback") sets .hostname = "auth", .pathname = "/callback".
  // Also accept pinac:///auth/callback (triple-slash variant some OS handlers produce).
  const fullPath = `/${parsed.hostname}${parsed.pathname}`.replace(/\/+/g, "/");
  if (fullPath !== "/auth/callback") {
    emitError({
      code: "INVALID_URL",
      message: `Unexpected deep-link path: "${fullPath}". Expected "/auth/callback".`,
    });
    return;
  }

  // Step 2: Extract query params.
  const code  = parsed.searchParams.get("code");
  const state = parsed.searchParams.get("state");

  if (!code || !state) {
    emitError({
      code: "MISSING_PARAMS",
      message: "Deep-link callback is missing required 'code' or 'state' parameter.",
    });
    return;
  }

  // Step 3: Look up the in-memory pending flow.
  // SECURITY: This is the primary CSRF defence. If state doesn't match a flow
  // we started, we refuse to proceed — even if the code looks valid.
  const pendingFlow = getPendingFlow(state);

  if (!pendingFlow) {
    // Distinguish cold-start (no flows at all) from state mismatch (flows exist
    // but none match) to give the UI a better error message.
    const hasPendingFlows =
      typeof (getPendingFlow as { _size?: number })._size === "number"
        ? (getPendingFlow as { _size?: number })._size !== 0
        : false; // Can't directly check Map size from here; treat as cold-start.
    emitError({
      code: "NO_PENDING_FLOW",
      message:
        "No matching login attempt found. " +
        "This can happen if the app was restarted before the login completed (cold start), " +
        "or if the callback was replayed. Please initiate a new login.",
      coldStart: true,
    });
    return;
  }

  // Step 4: State matched — extract the verifier and IMMEDIATELY clear the flow
  // to prevent replay of the same callback.
  const { codeVerifier } = pendingFlow;
  clearPendingFlow(state);

  // Step 5: Read the native client ID (same one used in startLogin).
  const nativeClientId = import.meta.env.VITE_WORKOS_NATIVE_CLIENT_ID as string | undefined;
  if (!nativeClientId) {
    emitError({
      code: "EXCHANGE_FAILED",
      kind: "UNKNOWN",
      message: "VITE_WORKOS_NATIVE_CLIENT_ID is not configured in desktop/.env.",
    });
    return;
  }

  // Step 6: Exchange code + verifier for tokens.
  // The verifier is only ever sent in this one call and is then discarded.
  const result = await exchangeCodeForTokens(code, codeVerifier, nativeClientId);

  if (!result.ok) {
    emitError({
      code: "EXCHANGE_FAILED",
      kind: result.error.kind,
      message: result.error.message,
    });
    return;
  }

  const { accessToken, refreshToken, user, accessTokenExpiresIn } = result.data;

  // Step 7: Persist tokens to encrypted storage.
  try {
    await saveTokens({
      accessToken,
      refreshToken,
      // expiresAt = now + (expiresIn seconds) - 30s safety buffer.
      expiresAt: Date.now() + ((accessTokenExpiresIn ?? 300) - 30) * 1000,
      userId: user.id,
      userEmail: user.email,
    });
  } catch (storageErr) {
    emitError({
      code: "STORAGE_ERROR",
      message:
        storageErr instanceof Error
          ? storageErr.message
          : "Failed to persist auth tokens to secure storage.",
    });
    return;
  }

  // Step 8: Notify the UI of success.
  emitSuccess({ userId: user.id, userEmail: user.email });
}

// ---------------------------------------------------------------------------
// Initialiser — call once at app startup
// ---------------------------------------------------------------------------

let initialised = false;

/**
 * Registers the deep-link listeners. Must be called once during app startup
 * (e.g. in `main.tsx` or an app-level effect).
 *
 * Also checks `getCurrent()` to handle the case where the app was launched
 * directly by a deep-link click (the URL arrives as a launch-time event that
 * would otherwise be missed by the async listener registration).
 */
export async function initDeepLinkHandler(): Promise<void> {
  if (initialised) return;
  initialised = true;

  // Listener 1: macOS + general Tauri deep-link events.
  await onOpenUrl((urls) => {
    for (const url of urls) {
      handleDeepLinkUrl(url).catch((err: unknown) => {
        console.error("[auth] Unhandled error in handleDeepLinkUrl:", err);
      });
    }
  });

  // Listener 2: Windows / Linux — URL forwarded from the second process by
  // the Rust single-instance callback (see lib.rs).
  await listen<string>("deep-link://new-url", (event) => {
    handleDeepLinkUrl(event.payload).catch((err: unknown) => {
      console.error("[auth] Unhandled error in handleDeepLinkUrl:", err);
    });
  });

  // Check for a launch-time deep-link (app was opened by clicking a pinac:// link).
  // getCurrent() returns the URLs that triggered the app launch, if any.
  const launchUrls = await getCurrent();
  if (launchUrls) {
    for (const url of launchUrls) {
      await handleDeepLinkUrl(url);
    }
  }
}
