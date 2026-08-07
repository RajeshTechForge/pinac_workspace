import { useAuth, type AuthStatus } from "../../context/AuthContext";
import LoadingScreen from "./LoadingScreen";
import AuthScreen from "./AuthScreen";
import AppShell from "../layout/AppShell";

type TopLevelScreen = "checking" | "unauthenticated" | "authenticated";

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
