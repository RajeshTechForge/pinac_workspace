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
  readonly login: () => Promise<void>;
  readonly logout: () => Promise<void>;
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

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, dispatch] = useReducer(authReducer, { kind: "checking" });

  // ── Session check + deep-link listener setup (runs once on mount) ─────────
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
          message:
            err instanceof Error
              ? err.message
              : "Failed to open browser for login.",
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

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
