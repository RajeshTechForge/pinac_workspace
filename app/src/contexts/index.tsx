import React from "react";

import { AuthProvider } from "./Authentication";
import { ModalBoxProvider } from "./ModalBox";
import { ModelSettingsProvider } from "./LlmSettings";
import { UIProvider } from "./UIContext";
import { AttachmentProvider } from "./Attachment";
import { ChatProvider } from "./Chat";

interface AppProvidersProps {
  children: React.ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <AuthProvider>
      <ModalBoxProvider>
        <ModelSettingsProvider>
          <UIProvider>
            <AttachmentProvider>
              <ChatProvider>{children}</ChatProvider>
            </AttachmentProvider>
          </UIProvider>
        </ModelSettingsProvider>
      </ModalBoxProvider>
    </AuthProvider>
  );
};

export * from "./Authentication";
export * from "./ModalBox";
export * from "./LlmSettings";
export * from "./UIContext";
export * from "./Attachment";
export * from "./Chat";
