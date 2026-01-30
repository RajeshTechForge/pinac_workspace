import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";
import { UIMessage } from "@/types";

interface ChatContextValue {
  messages: UIMessage[];
  sessionId: string | null;
  isStreaming: boolean;

  addMessage: (message: Omit<UIMessage, "id" | "timestamp">) => UIMessage;
  updateMessage: (id: string, updates: Partial<UIMessage>) => void;
  clearMessages: () => void;
  setSessionId: (id: string | null) => void;
  setIsStreaming: (streaming: boolean) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

interface ChatProviderProps {
  children: React.ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [sessionId, setSessionIdState] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  // Use ref to generate consistent IDs
  const messageCounterRef = useRef(0);

  const addMessage = useCallback(
    (message: Omit<UIMessage, "id" | "timestamp">): UIMessage => {
      const newMessage: UIMessage = {
        ...message,
        id: `msg_${Date.now()}_${messageCounterRef.current++}`,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, newMessage]);
      return newMessage;
    },
    [],
  );

  const updateMessage = useCallback(
    (id: string, updates: Partial<UIMessage>) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg)),
      );
    },
    [],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    messageCounterRef.current = 0;
  }, []);

  const setSessionId = useCallback((id: string | null) => {
    setSessionIdState(id);
  }, []);

  const value: ChatContextValue = {
    messages,
    sessionId,
    isStreaming,
    addMessage,
    updateMessage,
    clearMessages,
    setSessionId,
    setIsStreaming,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

//    CUSTOM HOOK
// ---------------------

export const useChatContext = (): ChatContextValue => {
  const context = useContext(ChatContext);

  if (!context) {
    throw new Error("useChatContext must be used within ChatProvider");
  }

  return context;
};
