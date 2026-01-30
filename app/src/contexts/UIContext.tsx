import React, { createContext, useContext, useState, useCallback } from "react";

interface UIContextValue {
  isWelcomeVisible: boolean;
  inputText: string;
  isInputDisabled: boolean;

  setWelcomeVisible: (visible: boolean) => void;
  setInputText: (text: string) => void;
  setInputDisabled: (disabled: boolean) => void;
  resetInput: () => void;
}

const UIContext = createContext<UIContextValue | null>(null);

interface UIProviderProps {
  children: React.ReactNode;
}

export const UIProvider: React.FC<UIProviderProps> = ({ children }) => {
  const [isWelcomeVisible, setWelcomeVisible] = useState(true);
  const [inputText, setInputText] = useState("");
  const [isInputDisabled, setInputDisabled] = useState(false);

  const resetInput = useCallback(() => {
    setInputText("");
  }, []);

  const value: UIContextValue = {
    isWelcomeVisible,
    inputText,
    isInputDisabled,
    setWelcomeVisible,
    setInputText,
    setInputDisabled,
    resetInput,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

//    CUSTOM HOOK
// ---------------------

export const useUIContext = (): UIContextValue => {
  const context = useContext(UIContext);

  if (!context) {
    throw new Error("useUIContext must be used within UIProvider");
  }

  return context;
};
