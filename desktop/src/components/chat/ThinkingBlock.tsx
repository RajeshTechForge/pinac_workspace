import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

type ThinkingBlockProps = {
  content: string;
  /** When true the block auto-expands; when transitioning false it auto-collapses. */
  thinkingStreaming?: boolean;
};

export default function ThinkingBlock({
  content,
  thinkingStreaming,
}: ThinkingBlockProps) {
  const [open, setOpen] = useState(false);

  // Auto-expand while thinking is streaming; auto-collapse when answer starts.
  useEffect(() => {
    if (thinkingStreaming) {
      setOpen(true);
    } else if (thinkingStreaming === false && content) {
      setOpen(false);
    }
  }, [thinkingStreaming]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!content) return null;

  return (
    <div className="mb-3 border-l-2 border-accent/25 bg-surface-2/40 rounded-sm overflow-hidden">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1.5 w-full px-3 py-1.5 text-[11px] font-mono text-text-muted hover:text-text-secondary hover:bg-surface-3/50 transition-colors duration-100"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span>Thought</span>
      </button>

      {open && (
        <div className="px-3 pb-2 text-[13px] leading-relaxed text-text-muted italic whitespace-pre-wrap warp-break-words">
          {content}
        </div>
      )}
    </div>
  );
}
