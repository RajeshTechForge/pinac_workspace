import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  className?: string;
}

export default function Select({ value, options, onChange, className = "" }: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (optionValue: string) => {
      onChange(optionValue);
      setOpen(false);
    },
    [onChange],
  );

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full bg-surface-2 border border-border rounded-sm px-3 py-1.5 text-sm text-text-primary font-ui flex items-center justify-between gap-2 outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-colors duration-100 cursor-pointer"
      >
        <span>{selected?.label ?? value}</span>
        <ChevronDown size={12} className={`text-text-muted transition-transform duration-100 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface-2 border border-border rounded-sm shadow-lg z-50 overflow-hidden">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`w-full text-left px-3 py-1.5 text-sm font-ui transition-colors duration-75 cursor-pointer ${
                option.value === value
                  ? "bg-surface-3 text-text-primary"
                  : "text-text-secondary hover:bg-surface-3 hover:text-text-primary"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
