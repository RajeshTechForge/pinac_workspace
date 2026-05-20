import { useState, useEffect } from "react";

export default function StreamingIndicator() {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 400);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-1.5 px-4 py-2 text-text-muted font-mono text-[13px]">
      <span>Thinking{dots}</span>
      <span className="inline-block w-0.5 h-3.5 bg-accent animate-pulse" />
    </div>
  );
}
