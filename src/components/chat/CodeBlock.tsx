import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CodeBlockProps {
  code: string;
  language?: string;
}

export default function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard not available
    }
  }

  return (
    <div className="my-2 group relative">
      <div className="flex items-center justify-between px-3 py-1 bg-surface-2 border border-border border-b-0 rounded-t-sm">
        <span className="text-[11px] font-mono text-text-muted">
          {language ?? "code"}
        </span>
        <button
          aria-label="Copy code"
          onClick={copy}
          className="p-1 text-text-muted hover:text-text-secondary opacity-0 group-hover:opacity-100 transition-all duration-100"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
      <pre className="bg-surface-3 border border-border rounded-b-sm overflow-x-auto">
        <code className="block px-3 py-2.5 text-[13px] font-mono leading-relaxed text-text-primary whitespace-pre">
          {code}
        </code>
      </pre>
    </div>
  );
}
