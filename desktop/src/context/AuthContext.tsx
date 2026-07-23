/**
 * AuthContext.tsx — Shared auth state for the Pinac desktop app.
 *
 * Owns the full auth lifecycle:
 *  - Cold-start session check (isAuthenticated + getCurrentUser).
 *  - Deep-link success / error events (via the module-level event bus).
 *  - Refresh timer — keeps the access token alive while the app is open.
 *  - Login / logout actions exposed to child components via useAuth().
 *
 * Design notes:
 *  - Subscriptions (onAuthSuccess, onAuthError) are registered at the Provider
 *    level so they fire regardless of which screen is currently rendered.
 *  - The Provider is the only component that calls initDeepLinkHandler().
 *  - Children never call invoke() or auth-lib functions directly — they go
 *    through this context's action dispatchers.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from "react";
import {
  initDeepLinkHandler,
  onAuthSuccess,
  onAuthError,
  startLogin,
  isAuthenticated,
  getCurrentUser,
  startRefreshTimer,
  stopRefreshTimer,
  logout as authLogout,
  type DeepLinkAuthError,
  type CurrentUser,
} from "../lib/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Discriminated union representing every possible auth state.
 * The UI reads `.kind` to decide what to render — no boolean flags.
 */
export type AuthStatus =
  | { readonly kind: "checking" }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "authenticated"; readonly user: CurrentUser }
  | { readonly kind: "waiting" }
  | { readonly kind: "error"; readonly error: DeepLinkAuthError };

/** Action union used by the internal auth reducer. */
type AuthAction =
  | { readonly type: "SET_CHECKING" }
  | { readonly type: "SET_UNAUTHENTICATED" }
  | { readonly type: "SET_AUTHENTICATED"; readonly user: CurrentUser }
  | { readonly type: "SET_WAITING" }
  | { readonly type: "SET_ERROR"; readonly error: DeepLinkAuthError };

/** Value shape exposed to all consumers via useAuth(). */
export type AuthContextValue = {
  readonly status: AuthStatus;
  /** Opens the browser to begin the PKCE login flow. */
  readonly login: () => Promise<void>;
  /** Signs the user out and revokes the WorkOS session server-side. */
  readonly logout: () => Promise<void>;
  /** Resets an error state back to unauthenticated. */
  readonly dismissError: () => void;
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function authReducer(state: AuthStatus, action: AuthAction): AuthStatus {
  switch (action.type) {
    case "SET_CHECKING":
      return { kind: "checking" };
    case "SET_UNAUTHENTICATED":
      return { kind: "unauthenticated" };
    case "SET_AUTHENTICATED":
      return { kind: "authenticated", user: action.user };
    case "SET_WAITING":
      return { kind: "waiting" };
    case "SET_ERROR":
      return { kind: "error", error: action.error };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Wraps the entire application. Must be the outermost provider — rendered
 * before ChatProvider so auth state is available everywhere.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, dispatch] = useReducer(authReducer, { kind: "checking" });

  // ── Session check + deep-link listener setup (runs once on mount) ─────────
  // Registers OS-level deep-link listeners and checks stored session state.
  // Subscriptions live at the provider level so they fire independently of
  // which screen the user is currently viewing.
  useEffect(() => {
    let cancelled = false;

    // Register deep-link listeners. Idempotent — safe if called twice.
    initDeepLinkHandler().catch((err: unknown) => {
      console.error("[AuthContext] initDeepLinkHandler failed:", err);
    });

    // Subscribe to deep-link auth events. Unsubscribed on unmount.
    const unsubSuccess = onAuthSuccess(async () => {
      if (cancelled) return;
      const user = await getCurrentUser();
      if (cancelled || !user) return;
      dispatch({ type: "SET_AUTHENTICATED", user });
      startRefreshTimer(undefined, () => {
        // Refresh token has been revoked — silently send user back to login.
        dispatch({ type: "SET_UNAUTHENTICATED" });
      });
    });

    const unsubError = onAuthError((error: DeepLinkAuthError) => {
      if (cancelled) return;
      dispatch({ type: "SET_ERROR", error });
    });

    // Check whether a valid session already exists in secure storage.
    // Transitions from "checking" to either "authenticated" or "unauthenticated".
    (async () => {
      try {
        const authed = await isAuthenticated();
        if (cancelled) return;

        if (authed) {
          const user = await getCurrentUser();
          if (cancelled) return;
          if (user) {
            dispatch({ type: "SET_AUTHENTICATED", user });
            startRefreshTimer(undefined, () => {
              dispatch({ type: "SET_UNAUTHENTICATED" });
            });
          } else {
            // Tokens exist but couldn't decode user — treat as unauthenticated.
            dispatch({ type: "SET_UNAUTHENTICATED" });
          }
        } else {
          dispatch({ type: "SET_UNAUTHENTICATED" });
        }
      } catch {
        // Any unexpected error during startup → fail to unauthenticated.
        if (!cancelled) {
          dispatch({ type: "SET_UNAUTHENTICATED" });
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubSuccess();
      unsubError();
    };
  }, []); // Intentionally empty: registers once at mount, cleaned up at unmount.

  // ── Action: login ──────────────────────────────────────────────────────────
  const login = useCallback(async (): Promise<void> => {
    dispatch({ type: "SET_WAITING" });
    try {
      await startLogin();
      // startLogin() returns as soon as the system browser opens.
      // The actual result arrives via the onAuthSuccess / onAuthError handlers above.
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        error: {
          code: "EXCHANGE_FAILED",
          kind: "UNKNOWN",
          message: err instanceof Error ? err.message : "Failed to open browser for login.",
        },
      });
    }
  }, []);

  // ── Action: logout ─────────────────────────────────────────────────────────
  const logout = useCallback(async (): Promise<void> => {
    stopRefreshTimer();
    // true = revoke the WorkOS session server-side so no device can reuse the token.
    await authLogout(true);
    dispatch({ type: "SET_UNAUTHENTICATED" });
  }, []);

  // ── Action: dismissError ───────────────────────────────────────────────────
  const dismissError = useCallback((): void => {
    dispatch({ type: "SET_UNAUTHENTICATED" });
  }, []);

  return (
    <AuthContext.Provider value={{ status, login, logout, dismissError }}>
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the current auth context value.
 *
 * @throws {Error} if called outside an AuthProvider — enforces correct usage
 *                 at runtime rather than allowing a silent null value.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
