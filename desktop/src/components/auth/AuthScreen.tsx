import { AlertTriangle, ArrowRight } from "lucide-react";
import TitleBar from "../layout/TitleBar";
import Button from "../ui/Button";
import { useAuth, type AuthStatus } from "../../context/AuthContext";
import type { DeepLinkAuthError } from "../../lib/auth";

// Error message mapping

function errorMessage(error: DeepLinkAuthError): string {
  switch (error.code) {
    case "INVALID_URL":
      return "Received an invalid response. Please try signing in again.";
    case "MISSING_PARAMS":
      return "The login response was incomplete. Please try again.";
    case "NO_PENDING_FLOW":
      return "The login session expired or was restarted. Please sign in again.";
    case "STATE_MISMATCH":
      return "A security check failed. Please initiate a new login.";
    case "FLOW_EXPIRED":
      return "The login window timed out. Please try again.";
    case "EXCHANGE_FAILED":
      switch (error.kind) {
        case "NETWORK":
          return "A network error occurred. Check your connection and try again.";
        case "INVALID_GRANT":
          return "The login grant was invalid or expired. Please try again.";
        case "RATE_LIMITED":
          return "Too many login attempts. Please wait a moment and try again.";
        case "UNKNOWN":
          return "Something went wrong during login. Please try again.";
      }
    // Exhaustive — no default needed for EXCHANGE_FAILED because of inner switch.
    case "STORAGE_ERROR":
      return "Failed to save your session locally. Please try again.";
  }
}

// Sub-components
function ErrorAlert({ error }: { error: DeepLinkAuthError }) {
  return (
    <div
      role="alert"
      className="w-full max-w-xs bg-surface-2 border border-border rounded-sm px-3 py-2.5 flex gap-2.5 items-start"
    >
      <AlertTriangle
        size={14}
        className="text-accent mt-0.5 shrink-0"
        aria-hidden
      />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-ui font-medium text-text-secondary leading-snug">
          Login failed
        </span>
        <span className="text-sm font-ui text-text-secondary/80 leading-relaxed">
          {errorMessage(error)}
        </span>
        <span className="text-[10px] font-mono text-text-muted mt-0.5 uppercase tracking-wide">
          [{error.code}]
        </span>
      </div>
    </div>
  );
}

/** Pulsing dot used to indicate an ongoing browser login. */
function PulsingDot() {
  return (
    <span
      aria-hidden
      className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0"
    />
  );
}

// Main component
type ScreenVariant = "unauthenticated" | "waiting" | "error";

function resolveVariant(status: AuthStatus): ScreenVariant {
  switch (status.kind) {
    case "waiting":
      return "waiting";
    case "error":
      return "error";
    default:
      return "unauthenticated";
  }
}

export default function AuthScreen() {
  const { status, login, dismissError } = useAuth();
  const variant = resolveVariant(status);
  const isWaiting = variant === "waiting";
  const isError = variant === "error";

  return (
    <div className="h-dvh w-full flex flex-col bg-surface-0 overflow-hidden">
      {/* Window chrome — preserved so the window remains draggable. */}
      <TitleBar />

      {/* Center content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        {/* Brand mark */}
        <div className="flex flex-col items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-accent" />
          <h1 className="text-2xl font-ui font-semibold text-text-primary tracking-tight">
            Welcome to Pinac
          </h1>
          <p className="text-sm font-ui text-text-secondary max-w-xs text-center leading-relaxed">
            {isWaiting
              ? "Continue in your browser\u2026"
              : "Your AI workspace for thinking, coding, and creating."}
          </p>
        </div>

        {/* Thin accent divider */}
        <div className="w-12 h-px bg-border" aria-hidden />

        {/* Error alert — shown only in error state */}
        {isError && status.kind === "error" && (
          <ErrorAlert error={status.error} />
        )}

        {/* Primary CTA */}
        <div className="flex flex-col items-center gap-2.5">
          <Button
            id="auth-sign-in-btn"
            variant="accent"
            disabled={isWaiting}
            onClick={() => {
              void login();
            }}
            aria-label={isError ? "Try signing in again" : "Sign in with Pinac"}
          >
            {isWaiting && <PulsingDot />}
            {isError ? "Try Again" : "Sign in with Pinac"}
            {!isWaiting && <ArrowRight size={14} aria-hidden />}
          </Button>

          {/* Secondary actions for non-default states */}
          {isWaiting && (
            <button
              id="auth-start-over-btn"
              onClick={dismissError}
              className="text-[11px] font-ui text-text-muted hover:text-text-secondary transition-colors duration-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50 rounded-sm px-1"
            >
              Having trouble? Start over
            </button>
          )}
          {isError && (
            <Button
              id="auth-cancel-btn"
              variant="ghost"
              onClick={dismissError}
              aria-label="Cancel and return to sign-in screen"
            >
              Cancel
            </Button>
          )}
        </div>

        {/* Legal footer */}
        <p className="text-[11px] font-ui text-text-muted text-center leading-relaxed max-w-xs">
          By signing in you agree to our{" "}
          <span className="text-text-secondary">Terms of Service</span> &amp;{" "}
          <span className="text-text-secondary">Privacy Policy</span>.
        </p>
      </div>
    </div>
  );
}
