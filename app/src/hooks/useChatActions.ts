import { useCallback, useRef, useEffect } from "react";
import {
  useChatContext,
  useModelSettings,
  useAttachmentContext,
  useUIContext,
} from "@/contexts";
import {
  useChatStream,
  startChatStream,
  stopChatStream,
} from "./useChatStream";
import { ChatRequest, Message, UIMessage } from "@/types";
import { startNewSession, addMsgToSession } from "@/database/db";

interface UseChatActionsReturn {
  sendMessage: (content: string) => void;
  stopGeneration: () => void;
  startNewChat: () => void;
}

const generateSessionId = (): string => {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
};

const extractMessageId = (id: string): number => {
  return parseInt(id.split("_")[1], 10) || 0;
};

const convertToApiMessages = (messages: UIMessage[]): Message[] => {
  return messages
    .filter((msg) => msg.role === "user" || msg.role === "assistant")
    .map(({ role, content }) => ({ role, content }));
};

export const useChatActions = (): UseChatActionsReturn => {
  const chat = useChatContext();
  const modelSettings = useModelSettings();
  const attachment = useAttachmentContext();
  const ui = useUIContext();

  // Track the currently streaming message ID
  const streamingMessageRef = useRef<string | null>(null);
  const streamingContentRef = useRef<string>("");

  // Store stable references to context functions
  const chatRef = useRef(chat);
  const uiRef = useRef(ui);
  const modelSettingsRef = useRef(modelSettings);

  // Update refs when context changes
  useEffect(() => {
    chatRef.current = chat;
    uiRef.current = ui;
    modelSettingsRef.current = modelSettings;
  }, [chat, ui, modelSettings]);

  const saveMessageToDatabase = useCallback(
    async (
      messageId: number,
      role: "user" | "assistant",
      content: string,
      modelName: string,
      attachmentName?: string,
    ) => {
      let currentSessionId = chat.sessionId;

      if (!currentSessionId) {
        currentSessionId = generateSessionId();
        chat.setSessionId(currentSessionId);

        const title = content.slice(0, 50);
        await startNewSession(currentSessionId, title);
      }
      await addMsgToSession(
        currentSessionId,
        messageId,
        role,
        content,
        modelName,
        attachmentName,
      );
    },
    [chat],
  );

  const handleStreamData = useCallback(
    (chunk: any) => {
      if (!streamingMessageRef.current || !chunk.content) return;

      streamingContentRef.current += chunk.content;
      chatRef.current.updateMessage(streamingMessageRef.current, {
        content: streamingContentRef.current,
        isStreaming: !chunk.done,
      });
    },
    [], // No dependencies - uses refs
  );

  const handleStreamDone = useCallback(async () => {
    if (!streamingMessageRef.current) return;

    const messageId = extractMessageId(streamingMessageRef.current);
    const content = streamingContentRef.current;
    const modelName = modelSettingsRef.current.getCurrentModelName();

    chatRef.current.updateMessage(streamingMessageRef.current, {
      isStreaming: false,
    });

    await saveMessageToDatabase(messageId, "assistant", content, modelName);

    // Reset state
    streamingMessageRef.current = null;
    streamingContentRef.current = "";
    uiRef.current.setInputDisabled(false);
    chatRef.current.setIsStreaming(false);
  }, [saveMessageToDatabase]); // Only saveMessageToDatabase as dependency

  const handleStreamError = useCallback(
    (error: string) => {
      if (!streamingMessageRef.current) return;

      const errorMessage = `**Error:** ${error}\n\nPlease try again.`;

      chatRef.current.updateMessage(streamingMessageRef.current, {
        content: errorMessage,
        isStreaming: false,
      });

      // Reset state
      streamingMessageRef.current = null;
      streamingContentRef.current = "";
      uiRef.current.setInputDisabled(false);
      chatRef.current.setIsStreaming(false);
    },
    [], // No dependencies - uses refs
  );

  // Set up IPC stream listeners - register handlers for this instance
  const { registerHandlers } = useChatStream();

  // Register handlers once on mount
  useEffect(() => {
    registerHandlers({
      onData: handleStreamData,
      onError: handleStreamError,
      onDone: handleStreamDone,
    });
  }, [registerHandlers, handleStreamData, handleStreamError, handleStreamDone]);

  // Send a message to the AI
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      ui.setInputDisabled(true);
      ui.setWelcomeVisible(false);
      chat.setIsStreaming(true);

      const modelName = modelSettings.getCurrentModelName();

      // Handle attachment
      let attachmentName: string | undefined;
      if (attachment.attachment && !attachment.isAttachmentUsed) {
        attachmentName = attachment.attachment.name;
        attachment.markAttachmentAsUsed();
      }

      const userMessage = chat.addMessage({
        role: "user",
        content,
        modelName,
        attachmentName,
      });

      const userMessageId = extractMessageId(userMessage.id);
      await saveMessageToDatabase(
        userMessageId,
        "user",
        content,
        modelName,
        attachmentName,
      );

      const aiMessage = chat.addMessage({
        role: "assistant",
        content: "",
        modelName,
        isStreaming: true,
      });

      streamingMessageRef.current = aiMessage.id;
      streamingContentRef.current = "";

      // Prepare API request
      const provider = modelSettings.selectedProviderId;
      const modelId = modelSettings.selectedModelId;

      const existingMessages = convertToApiMessages(chat.messages);
      const apiMessages: Message[] = [
        ...existingMessages,
        { role: "user", content },
      ];

      const currentSettings = modelSettings.getCurrentSettings();

      const request: ChatRequest = {
        prompt: content,
        messages: apiMessages,
        provider,
        model: modelId,
        web_search: currentSettings.webSearch || false,
        ...(attachment.attachment && {
          rag: true,
          documents_path: attachment.attachment.path,
        }),
      };

      // Send request to main process
      startChatStream(request);

      ui.resetInput();
    },
    [chat, modelSettings, attachment, ui, saveMessageToDatabase],
  );

  const stopGeneration = useCallback(async () => {
    if (!chat.isStreaming || !streamingMessageRef.current) return;

    // Stop the stream
    await stopChatStream();

    const messageId = extractMessageId(streamingMessageRef.current);
    const partialContent =
      streamingContentRef.current || "[Generation stopped]";
    const modelName = modelSettings.getCurrentModelName();

    chat.updateMessage(streamingMessageRef.current, {
      content: partialContent,
      isStreaming: false,
    });

    // Save partial response to database
    await saveMessageToDatabase(
      messageId,
      "assistant",
      partialContent,
      modelName,
    );

    // Reset state
    streamingMessageRef.current = null;
    streamingContentRef.current = "";
    ui.setInputDisabled(false);
    chat.setIsStreaming(false);
  }, [chat, modelSettings, ui, saveMessageToDatabase]);

  const startNewChat = useCallback(() => {
    chat.clearMessages();
    chat.setSessionId(null);
    chat.setIsStreaming(false);
    ui.setWelcomeVisible(true);
    ui.setInputDisabled(false);
    ui.resetInput();
    attachment.clearAttachment();
  }, [chat, ui, attachment]);

  return {
    sendMessage,
    stopGeneration,
    startNewChat,
  };
};
