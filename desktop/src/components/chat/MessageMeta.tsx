import Badge from "../ui/Badge";

interface MessageMetaProps {
  timestamp: number;
  model?: string;
  tokenCount?: number;
  role: "user" | "assistant";
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function MessageMeta({ timestamp, model, tokenCount, role }: MessageMetaProps) {
  return (
    <div
      className={`flex items-center gap-2 opacity-0 group-hover/message:opacity-100 transition-opacity duration-100 mt-1 ${
        role === "user" ? "justify-start" : "justify-start"
      }`}
    >
      <span className="text-[11px] font-mono text-text-muted">{formatTime(timestamp)}</span>
      {model && (
        <span className="text-[11px] font-mono text-text-muted">{model}</span>
      )}
      {tokenCount && (
        <Badge>{tokenCount} tok</Badge>
      )}
    </div>
  );
}
