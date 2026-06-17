import { ArrowUp, Square } from "lucide-react";
import ModelPicker from "./ModelPicker";
import ThinkingPicker from "./ThinkingPicker";

type InputToolbarProps = {
  text: string;
  onSend: () => void;
  onCancel: () => void;
  isStreaming: boolean;
};

/** Estimates token count from raw text using a word-count heuristic. */
function estimateTokens(text: string): number {
  return Math.round(text.split(/\s+/).filter(Boolean).length * 1.3);
}

export default function InputToolbar({
  text,
  onSend,
  onCancel,
  isStreaming,
}: InputToolbarProps) {
  const canSend = text.trim().length > 0 && !isStreaming;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <ModelPicker />
        <ThinkingPicker />
      </div>

      {isStreaming ? (
        <button
          aria-label="Cancel streaming"
          onClick={onCancel}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-ui text-text-secondary bg-surface-3 border border-border rounded-sm hover:bg-surface-2 hover:text-text-primary transition-colors duration-100"
        >
          <Square size={12} />
          Cancel
        </button>
      ) : (
        <button
          aria-label="Send message"
          disabled={!canSend}
          onClick={onSend}
          className="flex items-center justify-center w-7 h-7 rounded-sm bg-accent text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-accent-dim transition-colors duration-100"
        >
          <ArrowUp size={14} />
        </button>
      )}
    </div>
  );
}
