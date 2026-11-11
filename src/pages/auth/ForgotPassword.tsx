import { FormEvent, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { Alert, Button, CircularProgress, Link, Stack, TextField } from "@mui/material";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import { auth } from "../../config/firebase";
import AuthLayout from "./AuthLayout";
import { authMessage } from "./fields";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResult({ ok: true, text: `Nếu ${email.trim()} có tài khoản, email đặt lại mật khẩu đã được gửi.` });
    } catch (err) {
      setResult({ ok: false, text: authMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Quên mật khẩu" subtitle="Nhập email, chúng tôi sẽ gửi liên kết đặt lại mật khẩu.">
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
            setResult(null);
          }}
        />
        {result && <Alert severity={result.ok ? "success" : "error"}>{result.text}</Alert>}
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={loading || !email}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
        >
          Gửi liên kết
        </Button>
        <Link
          component={RouterLink}
          to="/login"
          variant="body2"
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, alignSelf: "center" }}
        >
          <ArrowBackRounded fontSize="small" /> Quay lại đăng nhập
        </Link>
      </Stack>
    </AuthLayout>
  );
}
