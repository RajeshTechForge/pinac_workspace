import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "accent";
}

export default function Badge({ children, variant = "default" }: BadgeProps) {
  const base = "inline-flex items-center font-mono text-[11px] px-1.5 py-0.5 rounded-sm leading-none";
  const colors =
    variant === "accent"
      ? "bg-accent/15 text-accent"
      : "bg-surface-3 text-text-muted";

  return <span className={`${base} ${colors}`}>{children}</span>;
}
