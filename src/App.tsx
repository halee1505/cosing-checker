import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/auth/Login";
import ForgotPassword from "./pages/auth/ForgotPassword";
import QuickSearch from "./pages/QuickSearch";
import BatchCheck from "./pages/BatchCheck";
import ChangePassword from "./pages/ChangePassword";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/search" element={<QuickSearch />} />
        <Route path="/batch" element={<BatchCheck />} />
        <Route path="/account/password" element={<ChangePassword />} />
      </Route>
      {/* Old links */}
      <Route path="/read" element={<Navigate to="/batch" replace />} />
      <Route path="/reset" element={<Navigate to="/account/password" replace />} />
      <Route path="*" element={<Navigate to="/batch" replace />} />
    </Routes>
  );
}
