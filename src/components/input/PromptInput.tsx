import { useRef, useEffect, type KeyboardEvent } from "react";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function PromptInput({
  value,
  onChange,
  onSend,
  disabled,
  placeholder,
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      const maxHeight = 8 * 20;
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    }
  }, [value]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onSend();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      const { selectionStart, selectionEnd } = e.currentTarget;
      const newValue =
        value.slice(0, selectionStart) + "\n" + value.slice(selectionEnd);
      onChange(newValue);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = selectionStart + 1;
          textareaRef.current.selectionEnd = selectionStart + 1;
        }
      });
    }
  }

  return (
    <textarea
      ref={textareaRef}
      aria-label="Message input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      placeholder={placeholder ?? 'Ask anything  \u2318\u21B5 to send'}
      rows={1}
      className="w-full bg-transparent text-[14px] font-mono text-text-primary placeholder:text-text-muted resize-none focus:outline-none py-2 px-0 leading-5 max-h-40"
    />
  );
}
