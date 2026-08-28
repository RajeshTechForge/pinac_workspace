import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { Button } from "./Button";
import { ShieldCheck, RotateCcw } from "lucide-react";

type ErrorCode = "INVALID_BODY" | "INVALID_CODE" | "EXPIRED_CODE" | "API_ERROR";

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  INVALID_BODY: "Please enter the full verification code.",
  INVALID_CODE: "Incorrect code. Please check your email and try again.",
  EXPIRED_CODE: "This code has expired. Please request a new code below.",
  API_ERROR: "Verification failed. Please try again.",
};

const CODE_LENGTH = 6;

function readUrlParams(): { email: string; token: string } {
  if (typeof window === "undefined") return { email: "", token: "" };
  const params = new URLSearchParams(window.location.search);
  return {
    email: params.get("email") ?? "",
    token: params.get("token") ?? "",
  };
}

export function EmailVerificationForm() {
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const { email, token } = readUrlParams();

  // Auto-focus the first input on mount.
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const setDigit = (index: number, value: string): void => {
    // Allow only single digit.
    const digit = value.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    setError(null);
    setResendNotice(null);

    // Auto-advance to next input.
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ): void => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>): void => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
    if (pasted.length === 0) return;

    const newDigits = [...digits];
    for (let i = 0; i < CODE_LENGTH; i++) {
      newDigits[i] = pasted[i] ?? "";
    }
    setDigits(newDigits);
    setError(null);
    setResendNotice(null);

    // Focus the last filled input or the first empty one.
    const focusIndex = Math.min(pasted.length, CODE_LENGTH) - 1;
    inputRefs.current[focusIndex]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (submitting) return;

    const code = digits.join("");
    if (code.length !== CODE_LENGTH) {
      setError("Please enter the full 6-digit code.");
      return;
    }

    if (!email && !token) {
      setError(
        "Missing email address. Please sign in again to restart verification.",
      );
      return;
    }

    setError(null);
    setResendNotice(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code,
          email,
          pendingAuthenticationToken: token,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | { ok: true; redirectTo: string }
        | { ok: false; error: { code: ErrorCode; message: string } }
        | null;

      if (data && data.ok) {
        setSuccess(true);
        window.location.href = data.redirectTo;
        return;
      }

      const errorCode = data && !data.ok ? data.error.code : "API_ERROR";
      setError(ERROR_MESSAGES[errorCode] ?? "Verification failed.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async (): Promise<void> => {
    if (resending || !email) return;
    setResending(true);
    setError(null);
    setResendNotice(null);

    try {
      const res = await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok: boolean;
        message?: string;
        error?: { code: string; message: string };
      } | null;

      if (data && data.ok) {
        setResendNotice("A new 6-digit code has been sent to your email!");
      } else {
        setError(
          data?.error?.message ??
            "Failed to resend code. Please wait a moment.",
        );
      }
    } catch {
      setError("Network error. Could not resend verification code.");
    } finally {
      setResending(false);
    }
  };

  const handleReset = (): void => {
    setDigits(Array(CODE_LENGTH).fill(""));
    setError(null);
    setResendNotice(null);
    inputRefs.current[0]?.focus();
  };

  return (
    <motion.div
      className="w-full space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {/* Header */}
      <div className="space-y-2 text-center">
        <motion.div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-nebula/10 ring-1 ring-nebula/25"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3, ease: "easeOut" }}
        >
          <ShieldCheck className="h-7 w-7 text-nebula" />
        </motion.div>

        <h1 className="text-2xl font-semibold tracking-tight text-star-100 mt-4">
          Verify your email
        </h1>
        <p className="text-sm text-star-300">
          {email ? (
            <>
              We sent a 6-digit code to{" "}
              <span className="font-medium text-star-200">{email}</span>
            </>
          ) : (
            "Enter the 6-digit code sent to your email"
          )}
        </p>
      </div>

      {/* Error message */}
      {error && (
        <motion.div
          className="rounded border border-redshift/40 bg-redshift/10 px-3 py-2 text-sm text-redshift"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {error}
        </motion.div>
      )}

      {/* Resend Notice */}
      {resendNotice && (
        <motion.div
          className="rounded border border-pulsar/40 bg-pulsar/10 px-3 py-2 text-sm text-pulsar"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {resendNotice}
        </motion.div>
      )}

      {/* Success message */}
      {success && (
        <motion.div
          className="rounded border border-pulsar/40 bg-pulsar/10 px-3 py-2 text-sm text-pulsar"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          Email verified! Redirecting…
        </motion.div>
      )}

      {/* OTP inputs */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex justify-center gap-3">
          {digits.map((digit, i) => (
            <motion.input
              key={i}
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              value={digit}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
              disabled={submitting || success}
              className={`h-14 w-11 text-center text-xl font-mono font-semibold bg-void-700 border text-star-100 focus:outline-none focus:ring-2 transition-all rounded-md
                ${
                  error
                    ? "border-redshift/50 focus:ring-redshift/30 focus:border-redshift/50"
                    : digit
                      ? "border-nebula/40 focus:ring-nebula/30 focus:border-nebula/50"
                      : "border-void-500/60 focus:ring-nebula/30 focus:border-nebula/50"
                }
                disabled:opacity-50 disabled:cursor-not-allowed`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i + 0.15, duration: 0.25 }}
            />
          ))}
        </div>

        <Button
          type="submit"
          fullWidth
          disabled={
            submitting || success || digits.join("").length !== CODE_LENGTH
          }
        >
          {submitting ? "Verifying…" : success ? "Verified ✓" : "Verify email"}
        </Button>
      </form>

      {/* Actions */}
      <div className="flex flex-col items-center gap-3 text-sm">
        <button
          type="button"
          onClick={handleReset}
          disabled={submitting || success}
          className="inline-flex items-center gap-1.5 text-star-400 hover:text-star-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Clear & re-enter
        </button>

        <div className="flex items-center gap-1.5 text-star-400">
          <span>Didn't receive a code?</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || submitting || success || !email}
            className="text-nebula hover:text-star-100 transition-colors font-medium disabled:opacity-50"
          >
            {resending ? "Sending…" : "Resend code"}
          </button>
        </div>

        <a
          href="/auth/sign-in"
          className="text-star-400 hover:text-star-200 transition-colors"
        >
          ← Back to sign in
        </a>
      </div>
    </motion.div>
  );
}
