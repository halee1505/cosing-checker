import { alpha, createTheme } from "@mui/material/styles";

const ink = "#0f172a";
const line = "#e2e8f0";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#0d7a6f", dark: "#095c54", light: "#3aa597", contrastText: "#fff" },
    secondary: { main: "#4f46e5" },
    error: { main: "#dc2626" },
    warning: { main: "#d97706" },
    info: { main: "#2563eb" },
    success: { main: "#16a34a" },
    text: { primary: ink, secondary: "#64748b" },
    divider: line,
    background: { default: "#f6f8fa", paper: "#ffffff" },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    h4: { fontWeight: 700, letterSpacing: "-0.02em" },
    h5: { fontWeight: 700, letterSpacing: "-0.01em" },
    h6: { fontWeight: 650 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
    overline: { fontWeight: 700, letterSpacing: "0.08em" },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: "#f6f8fa" },
        "::selection": { background: alpha("#0d7a6f", 0.18) },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        outlined: { borderColor: line },
        rounded: { borderRadius: 14 },
      },
    },
    MuiCard: {
      defaultProps: { variant: "outlined" },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 10, paddingInline: 16 } },
    },
    MuiTextField: { defaultProps: { size: "small" } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { backgroundColor: "#fff", borderRadius: 10 },
        notchedOutline: { borderColor: line },
      },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 600, borderRadius: 8 } },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: line },
        head: {
          fontWeight: 600,
          color: "#475569",
          backgroundColor: "#f8fafc",
          fontSize: 12.5,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          borderColor: line,
          "&.Mui-selected": {
            backgroundColor: alpha("#0d7a6f", 0.1),
            color: "#095c54",
            "&:hover": { backgroundColor: alpha("#0d7a6f", 0.16) },
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: { root: { textTransform: "none", fontWeight: 600, minHeight: 48 } },
    },
    MuiTooltip: {
      styleOverrides: { tooltip: { fontSize: 12.5, backgroundColor: ink } },
    },
  },
});
