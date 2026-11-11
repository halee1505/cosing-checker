import { FormEvent, useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { auth } from "../config/firebase";
import { authMessage, PasswordField } from "./auth/fields";

export default function ChangePassword() {
  const user = auth.currentUser;
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const mismatch = !!confirm && confirm !== newPassword;
  const tooShort = !!newPassword && newPassword.length < 6;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.email || mismatch || tooShort) return;
    setLoading(true);
    setResult(null);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, oldPassword));
      await updatePassword(user, newPassword);
      setResult({ ok: true, text: "Đã đổi mật khẩu." });
      setOldPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (err) {
      setResult({ ok: false, text: authMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 480, mx: "auto" }}>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
        <Typography variant="h5">Đổi mật khẩu</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
          Tài khoản {user?.email}
        </Typography>
        <Stack component="form" spacing={2} onSubmit={onSubmit}>
          <PasswordField
            label="Mật khẩu hiện tại"
            autoComplete="current-password"
            required
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />
          <PasswordField
            label="Mật khẩu mới"
            autoComplete="new-password"
            required
            value={newPassword}
            error={tooShort}
            helperText={tooShort ? "Tối thiểu 6 ký tự" : " "}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <PasswordField
            label="Nhập lại mật khẩu mới"
            autoComplete="new-password"
            required
            value={confirm}
            error={mismatch}
            helperText={mismatch ? "Mật khẩu nhập lại không khớp" : " "}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {result && <Alert severity={result.ok ? "success" : "error"}>{result.text}</Alert>}
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={loading || !oldPassword || !newPassword || mismatch || tooShort}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
          >
            Cập nhật mật khẩu
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
