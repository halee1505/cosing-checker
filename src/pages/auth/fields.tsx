import { useState } from "react";
import { IconButton, InputAdornment, TextField, TextFieldProps } from "@mui/material";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRounded from "@mui/icons-material/VisibilityOffRounded";

export function PasswordField(props: TextFieldProps) {
  const [show, setShow] = useState(false);
  return (
    <TextField
      {...props}
      type={show ? "text" : "password"}
      size="medium"
      fullWidth
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              onClick={() => setShow(!show)}
              edge="end"
              aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {show ? <VisibilityOffRounded /> : <VisibilityRounded />}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  );
}

/** Human-readable Vietnamese message for a Firebase Auth error. */
export function authMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-login-credentials":
      return "Email hoặc mật khẩu không đúng.";
    case "auth/invalid-email":
      return "Email không hợp lệ.";
    case "auth/too-many-requests":
      return "Thử sai quá nhiều lần. Vui lòng đợi một lát rồi thử lại.";
    case "auth/user-disabled":
      return "Tài khoản đã bị khoá.";
    case "auth/weak-password":
      return "Mật khẩu mới quá yếu (tối thiểu 6 ký tự).";
    case "auth/requires-recent-login":
      return "Phiên đăng nhập đã cũ, vui lòng đăng nhập lại.";
    case "auth/network-request-failed":
      return "Không có kết nối mạng.";
    default:
      return "Có lỗi xảy ra, vui lòng thử lại.";
  }
}
