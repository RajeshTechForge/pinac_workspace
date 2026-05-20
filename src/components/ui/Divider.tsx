interface DividerProps {
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export default function Divider({ orientation = "horizontal", className = "" }: DividerProps) {
  const base = "border-0 bg-border shrink-0";
  const dims =
    orientation === "horizontal" ? "h-px w-full" : "w-px h-full";

  return <div className={`${base} ${dims} ${className}`} />;
}
