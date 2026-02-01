import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "./contexts/Authentication";
import { MainLayout } from "./layouts/MainLayout";
import HomePage from "./pages/Home";
import SignInPage from "./pages/SignIn";
import { FrameHeader } from "./components/FrameHeader";
import "./index.css";

const AuthRoute = ({ children }: { children: JSX.Element }) => {
  const auth = useContext(AuthContext);
  if (auth?.isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return children;
};

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const auth = useContext(AuthContext);
  if (!auth?.isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }
  return children;
};

const App = () => {
  return (
    <HashRouter>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<HomePage />} />
        </Route>
        <Route
          path="/signin"
          element={
            <AuthRoute>
              <FrameHeader>
                <SignInPage />
              </FrameHeader>
            </AuthRoute>
          }
        />
      </Routes>
    </HashRouter>
  );
};
export default App;
