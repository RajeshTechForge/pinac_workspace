import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import {
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  ArrowRight,
  RotateCcw,
  Sparkles,
} from "lucide-react";

export type AuthCallbackError = {
  title: string;
  message: string;
  code?: string;
};

export type DesktopCallbackCardProps = {
  deepLinkUrl: string | null;
  error: AuthCallbackError | null;
};

export function DesktopCallbackCard({
  deepLinkUrl,
  error,
}: DesktopCallbackCardProps) {
  const [copied, setCopied] = useState(false);
  const [hasAttemptedRedirect, setHasAttemptedRedirect] = useState(false);

  // Attempt to trigger the deep link automatically on mount if valid
  useEffect(() => {
    if (!deepLinkUrl || error) return;

    // Small delay to allow the DOM & smooth entry animations to render first
    const timer = setTimeout(() => {
      try {
        window.location.href = deepLinkUrl;
        setHasAttemptedRedirect(true);
      } catch (err) {
        console.warn(
          "[desktop-callback] Automatic protocol redirect failed:",
          err,
        );
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [deepLinkUrl, error]);

  const handleCopyLink = useCallback(async () => {
    if (!deepLinkUrl) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(deepLinkUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (err) {
      console.warn("[desktop-callback] Clipboard copy failed:", err);
    }
  }, [deepLinkUrl]);

  // ---------------------------------------------------------------------------
  // ERROR STATE
  // ---------------------------------------------------------------------------
  if (error || !deepLinkUrl) {
    const errorTitle = error?.title ?? "Authentication Failed";
    const errorMessage =
      error?.message ??
      "The authentication callback URL is missing required parameters or has expired.";
    const errorCode = error?.code;

    return (
      <motion.div
        className="w-full max-w-md mx-auto p-6 minor-sm:p-8 rounded-2xl bg-void-800/80 border border-void-500/40 backdrop-blur-md shadow-2xl relative overflow-hidden text-center"
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {/* Subtle top edge glow in redshift */}
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-redshift/40 to-transparent pointer-events-none" />

        {/* Ambient background bloom */}
        <div className="absolute -top-16 -left-16 w-36 h-36 rounded-full bg-redshift/10 blur-[50px] pointer-events-none" />

        {/* Error Icon Badge */}
        <motion.div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-redshift/10 border border-redshift/30 ring-4 ring-redshift/5 text-redshift mb-6"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.35, ease: "easeOut" }}
        >
          <AlertTriangle className="h-8 w-8" />
        </motion.div>

        {/* Title & Description */}
        <h1 className="text-xl minor-sm:text-2xl font-semibold tracking-tight text-star-100 mb-3">
          {errorTitle}
        </h1>

        <p className="text-sm text-star-300 leading-relaxed mb-6">
          {errorMessage}
        </p>

        {errorCode && (
          <div className="mb-6 p-3 rounded-lg bg-void-900/90 border border-void-500/50 text-left font-mono text-xs text-star-300">
            <span className="text-star-400 block mb-1 uppercase tracking-wider text-[10px]">
              Error Code
            </span>
            <code className="text-redshift font-medium break-all">
              {errorCode}
            </code>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <a
            href="/auth/sign-in"
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-nebula/10 hover:bg-nebula/15 border border-nebula/30 hover:border-nebula/50 text-star-100 font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-nebula/40"
          >
            <RotateCcw className="w-4 h-4 text-nebula" />
            Try signing in again
          </a>

          <a
            href="/"
            className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-star-400 hover:text-star-200 text-sm transition-colors"
          >
            Return to homepage
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </motion.div>
    );
  }

  // ---------------------------------------------------------------------------
  // SUCCESS / HANDOFF STATE
  // ---------------------------------------------------------------------------
  return (
    <motion.div
      className="w-full max-w-md mx-auto p-6 minor-sm:p-8 rounded-2xl bg-void-800/80 border border-void-500/40 backdrop-blur-md shadow-2xl relative overflow-hidden text-center"
      initial={{ opacity: 0, scale: 0.95, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Subtle top edge highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-nebula/40 to-transparent pointer-events-none" />

      {/* Atmospheric ambient glows */}
      <div className="absolute -top-12 -left-12 w-32 h-32 rounded-full bg-pulsar/10 blur-[45px] pointer-events-none" />
      <div className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full bg-nebula/10 blur-[45px] pointer-events-none" />

      {/* Success Animated Badge */}
      <motion.div
        className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-pulsar/10 border border-pulsar/30 ring-4 ring-pulsar/5 text-pulsar mb-6"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.35, ease: "easeOut" }}
      >
        {/* Orbiting star glow */}
        <motion.div
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-pulsar"
          animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <CheckCircle2 className="h-8 w-8 text-pulsar" />
      </motion.div>

      {/* Main Heading */}
      <h1 className="text-xl minor-sm:text-2xl font-semibold tracking-tight text-star-100 mb-2">
        You're signed in!
      </h1>

      {/* Subtitle with dynamic handoff status */}
      <p className="text-sm text-star-300 leading-relaxed mb-6">
        Returning you to Pinac Workspace desktop app&hellip;
      </p>

      {/* Cosmic Pulse Activity Bar */}
      <div className="w-full bg-void-900/80 rounded-full h-1.5 mb-6 overflow-hidden border border-void-500/30 relative">
        <motion.div
          className="h-full bg-linear-to-r from-pulsar via-nebula to-comet rounded-full"
          initial={{ x: "-100%", width: "50%" }}
          animate={{ x: ["-100%", "250%"] }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      {/* Primary Action — Open App Manually */}
      <div className="space-y-3 mb-6">
        <motion.a
          href={deepLinkUrl}
          className="relative flex items-center justify-center gap-2 w-full px-5 py-3 rounded-lg bg-nebula/15 hover:bg-nebula/25 border border-nebula/40 hover:border-nebula/60 text-star-100 font-medium text-sm transition-all shadow-[0_0_20px_-5px_rgba(130,170,255,0.25)] focus:outline-none focus:ring-2 focus:ring-nebula/40 group overflow-hidden"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <Sparkles className="w-4 h-4 text-nebula transition-transform group-hover:rotate-12" />
          <span>Open Pinac Workspace</span>
          <ExternalLink className="w-4 h-4 text-star-300 group-hover:text-star-100 transition-colors" />
        </motion.a>

        {/* Copy Callback Link Button */}
        <button
          type="button"
          onClick={handleCopyLink}
          className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg bg-void-700/60 hover:bg-void-600/60 border border-void-500/40 text-star-300 hover:text-star-200 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-void-400"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-pulsar" />
              <span className="text-pulsar">Callback link copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-star-400" />
              <span>Copy callback link</span>
            </>
          )}
        </button>
      </div>

      {/* Helpful Guidance Footer */}
      <p className="text-xs text-star-400 leading-normal">
        {hasAttemptedRedirect
          ? 'If your browser prompted to open the app, click "Open". You can safely close this tab once connected.'
          : "Connecting to the desktop client. You can safely close this window once connected."}
      </p>
    </motion.div>
  );
}
