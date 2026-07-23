/**
 * AuthGate.tsx — Root conditional renderer.
 *
 * The single point where auth state changes the visible top-level UI.
 * Reads status from AuthContext and delegates rendering to the appropriate
 * screen. Contains no side effects — all auth logic lives in AuthContext.
 */

import { useAuth, type AuthStatus } from "../../context/AuthContext";
import LoadingScreen from "./LoadingScreen";
import AuthScreen from "./AuthScreen";
import AppShell from "../layout/AppShell";

// ---------------------------------------------------------------------------
// Screen resolver
// ---------------------------------------------------------------------------

type TopLevelScreen = "checking" | "unauthenticated" | "authenticated";

/**
 * Collapses the full AuthStatus discriminated union into the three top-level
 * screens. `waiting` and `error` are both rendered inside AuthScreen (which
 * handles those sub-states itself), so both map to "unauthenticated".
 */
function resolveScreen(status: AuthStatus): TopLevelScreen {
  switch (status.kind) {
    case "checking":
      return "checking";
    case "authenticated":
      return "authenticated";
    case "unauthenticated":
    case "waiting":
    case "error":
      return "unauthenticated";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders the correct top-level screen based on the current auth status.
 * Must be a direct child of AuthProvider.
 */
export default function AuthGate() {
  const { status } = useAuth();
  const screen = resolveScreen(status);

  switch (screen) {
    case "checking":
      return <LoadingScreen />;
    case "unauthenticated":
      return <AuthScreen />;
    case "authenticated":
      return <AppShell />;
  }
}
