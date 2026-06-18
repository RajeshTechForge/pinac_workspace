const SUGGESTIONS = [
  "Write a follow-up email to a client who ghosted my proposal",
  "Draft a project status update for my manager",
  "Prepare talking points for my performance review tomorrow",
  "Outline a 10-minute pitch presentation for HR",
  "Help me address a colleague who keeps missing deadlines",
  "Summarize this contract in plain English",
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-[11px] font-mono text-text-muted mx-auto w-fit text-left">
          <div className="flex items-center gap-2">
            <kbd className="px-1 py-0.5 bg-surface-2 border border-border rounded-xs text-text-secondary min-w-7 text-center inline-block">
              ⌘K
            </kbd>
            <span>Command palette</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-1 py-0.5 bg-surface-2 border border-border rounded-xs text-text-secondary min-w-7 text-center inline-block">
              ⌘N
            </kbd>
            <span>New conversation</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-1 py-0.5 bg-surface-2 border border-border rounded-xs text-text-secondary min-w-7 text-center inline-block">
              ⌘↵
            </kbd>
            <span>Send message</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-1 py-0.5 bg-surface-2 border border-border rounded-xs text-text-secondary min-w-7 text-center inline-block">
              ⌘,
            </kbd>
            <span>Open settings</span>
          </div>
        </div>
      </div>
    </div>
  );
}
