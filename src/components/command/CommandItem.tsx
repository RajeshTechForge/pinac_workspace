import { FileText, Settings, Plus, Trash2, Download } from "lucide-react";
import type { PaletteCommand } from "../../types";

const ICON_MAP: Record<string, React.ReactNode> = {
  "new-chat": <Plus size={14} />,
  "clear": <Trash2 size={14} />,
  "export": <Download size={14} />,
  "settings": <Settings size={14} />,
};

interface CommandItemProps {
  command: PaletteCommand;
  isSelected: boolean;
  onSelect: () => void;
  onHover: () => void;
}

export default function CommandItem({
  command,
  isSelected,
  onSelect,
  onHover,
}: CommandItemProps) {
  return (
    <button
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`flex items-center gap-3 w-full px-3 py-2 text-left transition-colors duration-75 ${
        isSelected
          ? "bg-accent/15 text-text-primary"
          : "text-text-secondary hover:bg-surface-3"
      }`}
    >
      <span className="w-5 h-5 flex items-center justify-center shrink-0">
        {ICON_MAP[command.icon ?? ""] ?? <FileText size={14} />}
      </span>
      <span className="text-[13px] font-ui flex-1 truncate">{command.label}</span>
      {command.shortcut && (
        <kbd className="text-[10px] font-mono text-text-muted bg-surface-2 px-1.5 py-0.5 rounded-xs border border-border shrink-0">
          {command.shortcut}
        </kbd>
      )}
    </button>
  );
}
