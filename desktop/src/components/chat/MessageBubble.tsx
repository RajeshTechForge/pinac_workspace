import MessageMeta from "./MessageMeta";
import CodeBlock from "./CodeBlock";
import MarkdownContent from "./MarkdownContent";
import type { Message } from "../../types";

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  streamingText?: string;
}

function renderContent(text: string) {
  const blocks: React.ReactNode[] = [];
  const parts = text.split(/(```\w*\n[\s\S]*?```)/g);

  let idx = 0;
  for (const part of parts) {
    const codeMatch = part.match(/```(\w*)\n([\s\S]*?)```/);
    if (codeMatch) {
      const [, lang, code] = codeMatch;
      blocks.push(<CodeBlock key={idx++} code={code.trim()} language={lang || undefined} />);
    } else if (part.trim()) {
      const lines = part.split("\n");
      blocks.push(
        <p key={idx++} className="whitespace-pre-wrap warp-break-words">
          {lines.map((line, li) => (
            <span key={li}>
              {line}
              {li < lines.length - 1 && <br />}
            </span>
          ))}
        </p>,
      );
    }
  }

  return blocks;
}

export default function MessageBubble({ message, isStreaming, streamingText }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const displayContent = isStreaming ? streamingText ?? "" : message.content;

  return (
    <div
      className={`group/message px-4 py-3 ${
        isUser
          ? "bg-surface-2 border-l-2 border-accent"
          : "border-t border-border-soft"
      }`}
    >
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`text-[11px] font-mono font-medium uppercase tracking-wider ${
              isUser ? "text-accent" : "text-text-muted"
            }`}
          >
            {isUser ? "You" : "Assistant"}
          </span>
        </div>
        <div className="text-[14px] font-ui leading-relaxed text-text-primary">
          {isUser
            ? renderContent(displayContent)
            : <MarkdownContent content={displayContent} />
          }
          {isStreaming && (
            <span className="inline-block w-0.5 h-4 ml-0.5 bg-accent animate-pulse align-text-bottom" />
          )}
        </div>
        {!isStreaming && (
          <MessageMeta
            timestamp={message.timestamp}
            model={message.model}
            tokenCount={message.tokenCount}
            role={message.role}
          />
        )}
      </div>
    </div>
  );
}
