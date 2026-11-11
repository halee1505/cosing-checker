import { ReactNode } from "react";
import { Box, Paper, Typography } from "@mui/material";
import Brand from "../../components/Brand";

export default function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2 }}>
      <Box sx={{ width: "100%", maxWidth: 380 }}>
        <Box sx={{ mb: 3, display: "flex", justifyContent: "center" }}>
          <Brand />
        </Box>
        <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
          <Typography variant="h6">{title}</Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
          <Box sx={{ mt: 3 }}>{children}</Box>
        </Paper>
      </Box>
    </Box>
  );
}
