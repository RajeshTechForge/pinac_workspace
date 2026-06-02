import { useRef, useEffect } from "react";
import ScrollArea from "../ui/ScrollArea";
import MessageBubble from "./MessageBubble";
import StreamingIndicator from "./StreamingIndicator";
import type { Message } from "../../types";

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
  streamingMessageId: string | null;
  streamingText: string;
  streamingThinkingText: string;
}

export default function MessageList({
  messages,
  isStreaming,
  streamingMessageId,
  streamingText,
  streamingThinkingText,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const handleScroll = (e: Event) => {
      const target = e.currentTarget as HTMLElement;
      const threshold = 60;
      const atBottom = target.scrollHeight - target.scrollTop - target.clientHeight < threshold;
      userScrolledRef.current = !atBottom;
    };

    scrollEl.addEventListener("scroll", handleScroll);
    return () => scrollEl.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!userScrolledRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingText, streamingThinkingText]);

  return (
    <ScrollArea ref={scrollRef} className="flex-1 min-h-0" role="log" aria-label="Message list">
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          isStreaming={isStreaming && streamingMessageId === msg.id}
          streamingText={streamingMessageId === msg.id ? streamingText : undefined}
          streamingThinkingText={streamingMessageId === msg.id ? streamingThinkingText : undefined}
        />
      ))}
      {isStreaming && !streamingMessageId && <StreamingIndicator />}
      <div ref={bottomRef} />
    </ScrollArea>
  );
}
