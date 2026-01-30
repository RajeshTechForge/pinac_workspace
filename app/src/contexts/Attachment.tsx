import React, { createContext, useContext, useState, useCallback } from "react";
import { FileAttachment } from "@/types";

interface AttachmentContextValue {
  attachment: FileAttachment | null;
  isAttachmentUsed: boolean;

  setAttachment: (file: FileAttachment | null) => void;
  setAttachmentFromPath: (filePath: string) => void;
  markAttachmentAsUsed: () => void;
  clearAttachment: () => void;
}

// Extract file details from full file path
const parseFilePath = (filePath: string): FileAttachment => {
  const parts = filePath.split(/[/\\]/);
  const fileNameWithExtension = parts[parts.length - 1] || "";
  const lastDotIndex = fileNameWithExtension.lastIndexOf(".");

  const nameWithoutExtension =
    lastDotIndex > 0
      ? fileNameWithExtension.substring(0, lastDotIndex)
      : fileNameWithExtension;
  const extension =
    lastDotIndex > 0 ? fileNameWithExtension.substring(lastDotIndex + 1) : "";

  return {
    name: fileNameWithExtension,
    path: filePath,
    extension,
    nameWithoutExtension,
  };
};

const AttachmentContext = createContext<AttachmentContextValue | null>(null);

interface AttachmentProviderProps {
  children: React.ReactNode;
}

export const AttachmentProvider: React.FC<AttachmentProviderProps> = ({
  children,
}) => {
  const [attachment, setAttachmentState] = useState<FileAttachment | null>(
    null,
  );
  const [isAttachmentUsed, setIsAttachmentUsed] = useState(false);

  const setAttachment = useCallback((file: FileAttachment | null) => {
    setAttachmentState(file);
    setIsAttachmentUsed(false);
  }, []);

  const setAttachmentFromPath = useCallback((filePath: string) => {
    const fileDetails = parseFilePath(filePath);
    setAttachmentState(fileDetails);
    setIsAttachmentUsed(false);
  }, []);

  const markAttachmentAsUsed = useCallback(() => {
    setIsAttachmentUsed(true);
  }, []);

  const clearAttachment = useCallback(() => {
    setAttachmentState(null);
    setIsAttachmentUsed(false);
  }, []);

  const value: AttachmentContextValue = {
    attachment,
    isAttachmentUsed,
    setAttachment,
    setAttachmentFromPath,
    markAttachmentAsUsed,
    clearAttachment,
  };

  return (
    <AttachmentContext.Provider value={value}>
      {children}
    </AttachmentContext.Provider>
  );
};

//    CUSTOM HOOK
// ---------------------

export const useAttachmentContext = (): AttachmentContextValue => {
  const context = useContext(AttachmentContext);

  if (!context) {
    throw new Error(
      "useAttachmentContext must be used within AttachmentProvider",
    );
  }

  return context;
};
