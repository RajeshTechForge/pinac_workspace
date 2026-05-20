const SUGGESTIONS = [
  "Explain the CAP theorem in simple terms",
  "Write a React hook for localStorage persistence",
  "Compare Postgres and SQLite for a desktop app",
  "Design a rate limiter for a REST API",
  "Refactor this Python function to be async",
  "How does TCP congestion control work?",
];

interface EmptyStateProps {
  onSelectSuggestion: (text: string) => void;
}

export default function EmptyState({ onSelectSuggestion }: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-md w-full text-center">
        <h1 className="text-2xl font-mono font-medium text-text-primary mb-1">
          pinac-workspace
        </h1>
        <p className="text-sm font-ui text-text-muted mb-8">
          AI assistant for your workflow
        </p>
        <div className="grid grid-cols-2 gap-2 mb-8">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onSelectSuggestion(s)}
              className="text-left text-[12px] font-ui text-text-secondary bg-surface-2 border border-border hover:bg-surface-3 hover:text-text-primary px-3 py-2 rounded-sm transition-colors duration-100"
            >
              {s}
            </button>
          ))}
        </div>
        <div className="text-[11px] font-mono text-text-muted space-y-1">
          <p>
            <kbd className="px-1 py-0.5 bg-surface-2 border border-border rounded-xs text-text-secondary">
              ⌘K
            </kbd>{" "}
            Command palette
          </p>
          <p>
            <kbd className="px-1 py-0.5 bg-surface-2 border border-border rounded-xs text-text-secondary">
              ⌘N
            </kbd>{" "}
            New conversation
          </p>
          <p>
            <kbd className="px-1 py-0.5 bg-surface-2 border border-border rounded-xs text-text-secondary">
              ⌘↵
            </kbd>{" "}
            Send message
          </p>
        </div>
      </div>
    </div>
  );
}
