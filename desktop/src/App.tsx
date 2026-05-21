import { ChatProvider } from "./context/ChatContext";
import AppShell from "./components/layout/AppShell";

export default function App() {
  return (
    <ChatProvider>
      <AppShell />
    </ChatProvider>
  );
}
