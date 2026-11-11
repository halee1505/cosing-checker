import { Navigate, useLocation } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { Box, CircularProgress } from "@mui/material";
import { auth } from "../config/firebase";

/** Renders children only once Firebase has confirmed a signed-in user. */
export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const [user, initializing] = useAuthState(auth);
  const location = useLocation();

  if (initializing) {
    return (
      <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}
