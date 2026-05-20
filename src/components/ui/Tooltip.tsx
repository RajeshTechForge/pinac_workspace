import { useState, useRef, useEffect, type ReactNode } from "react";

interface TooltipProps {
  label: string;
  shortcut?: string;
  children: ReactNode;
}

export default function Tooltip({ label, shortcut, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function show() {
    timeoutRef.current = setTimeout(() => setVisible(true), 400);
  }

  function hide() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
  }

  return (
    <div className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 pointer-events-none">
          <div className="bg-surface-3 border border-border text-text-secondary text-[11px] font-mono px-2 py-1 rounded-sm whitespace-nowrap flex items-center gap-1.5">
            <span>{label}</span>
            {shortcut && (
              <span className="text-text-muted bg-surface-2 px-1 rounded-xs">{shortcut}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
