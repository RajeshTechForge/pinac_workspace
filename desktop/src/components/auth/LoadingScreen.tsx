/**
 * LoadingScreen.tsx — Branded splash shown during the cold-start session check.
 *
 * Appears for the ~200ms while isAuthenticated() reads from secure storage.
 * A static mark (no spinner) is intentional: the check is near-instant and
 * a spinner would cause a distracting flash for returning users.
 */

export default function LoadingScreen() {
  return (
    <div
      className="h-dvh w-full flex flex-col items-center justify-center bg-surface-0"
      aria-label="Loading"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-accent" />
        <span className="text-sm font-ui font-medium text-text-primary/80 tracking-tight">
          Pinac
        </span>
      </div>
    </div>
  );
}
