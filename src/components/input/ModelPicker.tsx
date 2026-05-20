import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

const MODELS = [
  { id: "claude-sonnet-4-5", label: "claude-sonnet-4-5" },
  { id: "claude-opus-4", label: "claude-opus-4" },
  { id: "gpt-4o", label: "gpt-4o" },
  { id: "gemini-2.0", label: "gemini-2.0" },
];

interface ModelPickerProps {
  selected: string;
  onSelect: (model: string) => void;
}

export default function ModelPicker({ selected, onSelect }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const current = MODELS.find((m) => m.id === selected) ?? MODELS[0];

  return (
    <div ref={ref} className="relative">
      <button
        aria-label="Select model"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[11px] font-mono text-text-muted hover:text-text-secondary transition-colors duration-100 px-1.5 py-1 rounded-sm hover:bg-surface-3"
      >
        <span>{current.label}</span>
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 min-w-40 bg-surface-2 border border-border rounded-sm shadow-lg z-20">
          {MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                onSelect(m.id);
                setOpen(false);
              }}
              className={`block w-full text-left px-3 py-1.5 text-[12px] font-mono transition-colors duration-100 ${
                m.id === selected
                  ? "text-accent bg-accent/10"
                  : "text-text-secondary hover:bg-surface-3 hover:text-text-primary"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
