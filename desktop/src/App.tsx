import { AuthProvider } from "./context/AuthContext";
import { AuthGate } from "./components/auth";

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
