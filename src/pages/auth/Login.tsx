import { FormEvent, useState } from "react";
import { Link as RouterLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useAuthState } from "react-firebase-hooks/auth";
import { Alert, Button, CircularProgress, Link, Stack, TextField } from "@mui/material";
import { auth } from "../../config/firebase";
import AuthLayout from "./AuthLayout";
import { authMessage, PasswordField } from "./fields";

export default function Login() {
  const [user, initializing] = useAuthState(auth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/batch";

  if (!initializing && user && !loading) return <Navigate to={from} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(authMessage(err));
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Đăng nhập" subtitle="Dùng tài khoản được cấp để tiếp tục.">
      <Stack component="form" spacing={2} onSubmit={onSubmit}>
        <TextField
          label="Email"
          type="email"
          size="medium"
          autoComplete="email"
          autoFocus
          required
          fullWidth
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
        />
        <PasswordField
          label="Mật khẩu"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError("");
          }}
        />
        <Link component={RouterLink} to="/forgot-password" variant="body2" alignSelf="flex-end">
          Quên mật khẩu?
        </Link>
        {error && <Alert severity="error">{error}</Alert>}
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={loading || !email || !password}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
        >
          Đăng nhập
        </Button>
      </Stack>
    </AuthLayout>
  );
}
