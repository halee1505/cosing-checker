import { Box, Stack, Typography } from "@mui/material";
import ScienceRounded from "@mui/icons-material/ScienceRounded";

export default function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center">
      <Box
        sx={{
          width: 34,
          height: 34,
          borderRadius: 2,
          display: "grid",
          placeItems: "center",
          color: inverse ? "primary.main" : "#fff",
          bgcolor: inverse ? "#fff" : "primary.main",
          boxShadow: inverse ? undefined : "0 4px 12px rgba(13,122,111,.35)",
        }}
      >
        <ScienceRounded fontSize="small" />
      </Box>
      <Box>
        <Typography
          variant="subtitle1"
          sx={{ lineHeight: 1.1, fontWeight: 700, whiteSpace: "nowrap", color: inverse ? "#fff" : "text.primary" }}
        >
          CosIng Checker
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: inverse ? "rgba(255,255,255,.75)" : "text.secondary", display: { xs: "none", sm: "block" } }}
        >
          Kiểm tra thành phần mỹ phẩm EU
        </Typography>
      </Box>
    </Stack>
  );
}
