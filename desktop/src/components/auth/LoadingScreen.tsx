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
