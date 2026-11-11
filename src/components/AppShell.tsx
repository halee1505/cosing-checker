import { useState } from "react";
import { Link as RouterLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  AppBar,
  Avatar,
  Box,
  Container,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Tab,
  Tabs,
  Toolbar,
  Typography,
} from "@mui/material";
import SearchRounded from "@mui/icons-material/SearchRounded";
import FactCheckRounded from "@mui/icons-material/FactCheckRounded";
import KeyRounded from "@mui/icons-material/KeyRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import { auth } from "../config/firebase";
import Brand from "./Brand";

const NAV = [
  { to: "/batch", label: "Kiểm tra công thức", icon: <FactCheckRounded fontSize="small" /> },
  { to: "/search", label: "Tra cứu nhanh", icon: <SearchRounded fontSize="small" /> },
];

export default function AppShell() {
  const [user] = useAuthState(auth);
  const location = useLocation();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const current = NAV.find((n) => location.pathname.startsWith(n.to))?.to ?? false;
  const initial = (user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "rgba(255,255,255,.85)", backdropFilter: "blur(10px)" }}
      >
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ gap: { xs: 1, sm: 3 }, minHeight: { xs: 60 } }}>
            <Box component={RouterLink} to="/batch" sx={{ textDecoration: "none" }}>
              <Brand />
            </Box>
            <Tabs value={current} sx={{ alignSelf: "stretch", "& .MuiTabs-flexContainer": { height: "100%" } }}>
              {NAV.map((n) => (
                <Tab
                  key={n.to}
                  value={n.to}
                  component={RouterLink}
                  to={n.to}
                  icon={n.icon}
                  iconPosition="start"
                  label={<Box sx={{ display: { xs: "none", sm: "inline" } }}>{n.label}</Box>}
                  sx={{ minHeight: 60, minWidth: { xs: 48, sm: 90 }, px: { xs: 1.5, sm: 2 } }}
                />
              ))}
            </Tabs>
            <Box sx={{ flex: 1 }} />
            <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label="Tài khoản">
              <Avatar sx={{ width: 34, height: 34, bgcolor: "primary.main", fontSize: 15, fontWeight: 700 }}>
                {initial}
              </Avatar>
            </IconButton>
            <Menu
              anchorEl={anchor}
              open={!!anchor}
              onClose={() => setAnchor(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
              PaperProps={{ variant: "outlined", sx: { mt: 1, minWidth: 220 } }}
            >
              <Box sx={{ px: 2, py: 1.25 }}>
                <Typography variant="caption" color="text.secondary">
                  Đăng nhập với
                </Typography>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {user?.email}
                </Typography>
              </Box>
              <Divider />
              <MenuItem onClick={() => { setAnchor(null); navigate("/account/password"); }}>
                <ListItemIcon>
                  <KeyRounded fontSize="small" />
                </ListItemIcon>
                Đổi mật khẩu
              </MenuItem>
              <MenuItem
                onClick={async () => {
                  setAnchor(null);
                  await signOut(auth);
                  navigate("/login", { replace: true });
                }}
              >
                <ListItemIcon>
                  <LogoutRounded fontSize="small" />
                </ListItemIcon>
                Đăng xuất
              </MenuItem>
            </Menu>
          </Toolbar>
        </Container>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: { xs: 2.5, md: 4 }, flex: 1 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
