/**
 * LoginButton.example.tsx — Example integration of the PKCE auth flow.
 *
 * ⚠️  THIS IS AN EXAMPLE — do NOT ship this file as-is.
 *     Copy and adapt the relevant logic into your actual UI components.
 *     This file is excluded from production builds by convention (*.example.*).
 *
 * What this shows:
 *  1. Calling `initDeepLinkHandler()` once at the component tree root (do this
 *     in your App.tsx / a top-level effect, not per-button).
 *  2. Subscribing to `onAuthSuccess` / `onAuthError` events.
 *  3. Starting the refresh timer on successful login (and cleaning it up on logout).
 *  4. Calling `startLogin()` from a button click.
 *  5. Calling `logout()` with server-side revocation.
 *  6. Checking `isAuthenticated()` + `getCurrentUser()` on mount.
 */

import { useEffect, useState, useCallback } from "react";
import {
  initDeepLinkHandler,
  onAuthSuccess,
  onAuthError,
  startLogin,
  isAuthenticated,
  getCurrentUser,
  startRefreshTimer,
  stopRefreshTimer,
  logout,
  type AuthSuccessPayload,
  type DeepLinkAuthError,
  type CurrentUser,
} from "../lib/auth";

// ---------------------------------------------------------------------------
// Top-level initialiser (call ONCE in App.tsx, not here)
// ---------------------------------------------------------------------------

/**
 * Call this in your App.tsx or root component — NOT inside LoginButton.
 * It registers the deep-link listeners that fire independently of any
 * specific button being mounted.
 *
 * Example App.tsx usage:
 *
 *   import { useEffect } from "react";
 *   import { initDeepLinkHandler } from "./lib/auth";
 *
 *   export default function App() {
 *     useEffect(() => {
 *       initDeepLinkHandler().catch(console.error);
 *     }, []);
 *     // ... rest of app
 *   }
 */
export function useAuthInit(
  onSuccess: (payload: AuthSuccessPayload) => void,
  onError:   (error:   DeepLinkAuthError)  => void
): void {
  useEffect(() => {
    // Register listeners — idempotent (initDeepLinkHandler checks a flag).
    initDeepLinkHandler().catch((err: unknown) => {
      console.error("[auth] initDeepLinkHandler failed:", err);
    });

    const unsubSuccess = onAuthSuccess(onSuccess);
    const unsubError   = onAuthError(onError);

    return () => {
      unsubSuccess();
      unsubError();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty deps — run once
}

// ---------------------------------------------------------------------------
// Example component
// ---------------------------------------------------------------------------

interface LoginButtonProps {
  /** Called after successful login + token storage. */
  onLoginSuccess?: (user: CurrentUser) => void;
  /** Called on any auth error (browser close timeout, state mismatch, etc.). */
  onLoginError?:  (error: DeepLinkAuthError) => void;
}

type AuthState =
  | { status: "idle" }
  | { status: "waiting" }   // browser is open, waiting for callback
  | { status: "success"; user: CurrentUser }
  | { status: "error";   error: DeepLinkAuthError };

export function LoginButton({ onLoginSuccess, onLoginError }: LoginButtonProps) {
  const [authState, setAuthState] = useState<AuthState>({ status: "idle" });

  // ── 1. Check existing session on mount ───────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!(await isAuthenticated())) return;
      const user = await getCurrentUser();
      if (!cancelled && user) {
        setAuthState({ status: "success", user });
        // Restart the refresh timer (e.g. after app cold-start).
        startRefreshTimer(undefined, () => {
          setAuthState({ status: "idle" });
        });
      }
    })().catch(console.error);
    return () => { cancelled = true; };
  }, []);

  // ── 2. Subscribe to deep-link auth events ────────────────────────────────
  //    In a real app, lift these subscriptions to the App root so they fire
  //    even if this component unmounts while the browser is still open.
  useEffect(() => {
    const unsubSuccess = onAuthSuccess(async (payload) => {
      const user = await getCurrentUser();
      if (!user) return;
      setAuthState({ status: "success", user });

      // Start refresh timer; stop on session expiry → prompt re-login.
      startRefreshTimer(undefined, () => {
        setAuthState({ status: "idle" });
      });

      onLoginSuccess?.(user);
    });

    const unsubError = onAuthError((error) => {
      setAuthState({ status: "error", error });
      onLoginError?.(error);
    });

    return () => {
      unsubSuccess();
      unsubError();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 3. Login handler ──────────────────────────────────────────────────────
  const handleLogin = useCallback(async () => {
    setAuthState({ status: "waiting" });
    try {
      await startLogin();
      // startLogin() returns as soon as the browser is opened.
      // The actual auth result arrives via the onAuthSuccess/onAuthError listeners above.
    } catch (err) {
      setAuthState({
        status: "error",
        error: {
          code: "EXCHANGE_FAILED",
          kind: "UNKNOWN",
          message: err instanceof Error ? err.message : "Failed to open browser.",
        },
      });
    }
  }, []);

  // ── 4. Logout handler ─────────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    stopRefreshTimer();
    await logout(true); // true = revoke server-side session
    setAuthState({ status: "idle" });
  }, []);

  // ── 5. Render ─────────────────────────────────────────────────────────────
  if (authState.status === "success") {
    return (
      <div>
        <p>Signed in as {authState.user.email}</p>
        <button onClick={() => { void handleLogout(); }}>Sign out</button>
      </div>
    );
  }

  if (authState.status === "waiting") {
    return (
      <div>
        <p>Waiting for browser login…</p>
        <button disabled>Cancel</button>
        {/* In a real UI, add a timeout UX here — e.g. show a "cancel" link
            that calls clearPendingFlow(state) after N minutes. The pending
            flow will auto-expire after 10 minutes regardless. */}
      </div>
    );
  }

  if (authState.status === "error") {
    return (
      <div>
        <p style={{ color: "red" }}>
          Login failed: [{authState.error.code}] {authState.error.message}
        </p>
        <button onClick={() => { void handleLogin(); }}>Retry</button>
      </div>
    );
  }

  // idle
  return (
    <button onClick={() => { void handleLogin(); }}>
      Sign in with Pinac
    </button>
  );
}
