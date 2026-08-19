import { onOpenUrl, getCurrent } from "@tauri-apps/plugin-deep-link";
import { listen } from "@tauri-apps/api/event";
import { getPendingFlow, clearPendingFlow } from "./authFlow";
import { exchangeCodeForTokens } from "./tokenExchange";
import { saveTokens } from "./secureStorage";

export type DeepLinkAuthError =
  | { readonly code: "INVALID_URL"; readonly message: string }
  | { readonly code: "MISSING_PARAMS"; readonly message: string }
  | {
      readonly code: "NO_PENDING_FLOW";
      readonly message: string;
      readonly coldStart?: true;
    }
  | { readonly code: "STATE_MISMATCH"; readonly message: string }
  | { readonly code: "FLOW_EXPIRED"; readonly message: string }
  | {
      readonly code: "EXCHANGE_FAILED";
      readonly message: string;
      readonly kind: "INVALID_GRANT" | "EXPIRED_CODE" | "NETWORK" | "UNKNOWN";
    }
  | { readonly code: "STORAGE_ERROR"; readonly message: string };

/** Successful auth result surfaced to the UI. */
export interface AuthSuccessPayload {
  readonly userId: string;
  readonly userEmail: string;
}

// ---------------------------------------------------------------------------
// Internal event bus (lightweight — no external dep)
// ---------------------------------------------------------------------------

type AuthSuccessHandler = (payload: AuthSuccessPayload) => void;
type AuthErrorHandler = (error: DeepLinkAuthError) => void;

const successHandlers: Set<AuthSuccessHandler> = new Set();
const errorHandlers: Set<AuthErrorHandler> = new Set();

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

async function handleDeepLinkUrl(rawUrl: string): Promise<void> {
  // Step 1: Parse and validate the URL structure.
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    emitError({
      code: "INVALID_URL",
      message: `Cannot parse deep-link URL: "${rawUrl}"`,
    });
    return;
  }

  if (parsed.protocol !== "pinac:") {
    emitError({
      code: "INVALID_URL",
      message: `Unexpected deep-link scheme: "${parsed.protocol}". Expected "pinac:".`,
    });
    return;
  }

  const fullPath = `/${parsed.hostname}${parsed.pathname}`.replace(/\/+/g, "/");
  if (fullPath !== "/auth/callback") {
    emitError({
      code: "INVALID_URL",
      message: `Unexpected deep-link path: "${fullPath}". Expected "/auth/callback".`,
    });
    return;
  }

  // Step 2: Extract query params.
  const code = parsed.searchParams.get("code");
  const state = parsed.searchParams.get("state");

  if (!code || !state) {
    emitError({
      code: "MISSING_PARAMS",
      message:
        "Deep-link callback is missing required 'code' or 'state' parameter.",
    });
    return;
  }

  // Step 3: Look up the in-memory pending flow.
  const pendingFlow = getPendingFlow(state);

  if (!pendingFlow) {
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
  const nativeClientId = import.meta.env.VITE_WORKOS_CLIENT_ID as
    string | undefined;
  if (!nativeClientId) {
    emitError({
      code: "EXCHANGE_FAILED",
      kind: "UNKNOWN",
      message: "VITE_WORKOS_CLIENT_ID is not configured in desktop/.env.",
    });
    return;
  }

  // Step 6: Exchange code + verifier for tokens.
  const result = await exchangeCodeForTokens(
    code,
    codeVerifier,
    nativeClientId,
  );

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
