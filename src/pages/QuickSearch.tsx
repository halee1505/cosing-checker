import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  InputAdornment,
  Paper,
  Skeleton,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import SearchRounded from "@mui/icons-material/SearchRounded";
import TagRounded from "@mui/icons-material/TagRounded";
import TextFieldsRounded from "@mui/icons-material/TextFieldsRounded";
import HistoryRounded from "@mui/icons-material/HistoryRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import {
  CosingRecord,
  isRegistryNumber,
  isValidCas,
  CAS_RE,
  nameVariants,
  sameName,
  searchByNameRaw,
  searchByNumber,
  verdictFor,
} from "../lib/cosing";
import { AnnexChips, StatusChip } from "../components/StatusChip";
import DetailDrawer from "../components/DetailDrawer";

type Mode = "name" | "code";

const RECENT_KEY = "cosing.recent";
const EXAMPLES: Record<Mode, string[]> = {
  name: ["Salicylic Acid", "Niacinamide", "Phenoxyethanol", "Hydroquinone", "Titanium Dioxide"],
  code: ["69-72-7", "98-92-0", "122-99-6", "123-31-9", "200-712-3"],
};

function loadRecent(): { mode: Mode; q: string }[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveRecent(items: { mode: Mode; q: string }[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, 8)));
  } catch {
    /* storage unavailable: recent searches are optional */
  }
}

interface Results {
  mode: Mode;
  query: string;
  total: number;
  records: CosingRecord[];
}

function ResultRow({
  rec,
  exact,
  onOpen,
}: {
  rec: CosingRecord;
  exact: boolean;
  onOpen: () => void;
}) {
  return (
    <Paper
      variant="outlined"
      onClick={onOpen}
      sx={{
        p: 2,
        cursor: "pointer",
        transition: "border-color .15s, box-shadow .15s",
        borderColor: exact ? "primary.light" : undefined,
        "&:hover": { borderColor: "primary.main", boxShadow: "0 4px 16px rgba(15,23,42,.06)" },
      }}
    >
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="subtitle1" sx={{ wordBreak: "break-word" }}>
              {rec.inciName}
            </Typography>
            {exact && <Chip size="small" color="primary" label="Khớp chính xác" />}
            <Chip
              size="small"
              variant="outlined"
              label={rec.itemType === "substance" ? "Substance" : "Ingredient"}
              sx={{ height: 22 }}
            />
          </Stack>
          <Stack direction="row" spacing={2} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "ui-monospace, Menlo, monospace" }}>
              CAS {rec.casNumbers.join(", ") || "—"}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "ui-monospace, Menlo, monospace" }}>
              EC {rec.ecNumbers.join(", ") || "—"}
            </Typography>
          </Stack>
          {rec.functions.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: "capitalize" }}>
              {rec.functions.slice(0, 4).join(" · ").toLowerCase()}
              {rec.functions.length > 4 ? ` +${rec.functions.length - 4}` : ""}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
          <AnnexChips refs={rec.annexRefs} />
          <StatusChip verdict={verdictFor([rec])} />
          <ChevronRightRounded color="action" />
        </Stack>
      </Stack>
    </Paper>
  );
}

export default function QuickSearch() {
  const [mode, setMode] = useState<Mode>("name");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [exactOnly, setExactOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | "ingredient" | "substance">("all");
  const [selected, setSelected] = useState<CosingRecord | null>(null);
  const [recent, setRecent] = useState(loadRecent);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => () => ctrl.current?.abort(), []);

  const trimmed = query.trim();
  const looksLikeCode = isRegistryNumber(trimmed);
  const codeError =
    mode === "code" && trimmed && !looksLikeCode
      ? "Nhập mã CAS (vd. 69-72-7) hoặc EC (vd. 200-712-3)"
      : mode === "code" && CAS_RE.test(trimmed) && !isValidCas(trimmed)
      ? "Chữ số kiểm tra của mã CAS này không đúng – vẫn có thể tìm"
      : "";

  const run = async (m: Mode, q: string) => {
    const text = q.trim();
    if (!text) return;
    if (m === "name" && text.length < 2) {
      setError("Nhập ít nhất 2 ký tự");
      return;
    }
    if (m === "code" && !isRegistryNumber(text)) {
      setError("Mã không đúng định dạng CAS hoặc EC");
      return;
    }
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setMode(m);
    setQuery(text);
    setLoading(true);
    setError("");
    try {
      const r = m === "name" ? await searchByNameRaw(text, c.signal) : await searchByNumber(text, c.signal);
      setResults({ mode: m, query: text, total: r.total, records: r.records });
      const next = [{ mode: m, q: text }, ...recent.filter((x) => !(x.mode === m && x.q.toLowerCase() === text.toLowerCase()))];
      setRecent(next);
      saveRecent(next);
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(e?.message || "Không tra cứu được CosIng");
    } finally {
      if (ctrl.current === c) setLoading(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    run(mode, query);
  };

  const isExact = (rec: CosingRecord) =>
    !!results && (results.mode === "code" ? true : sameName(rec, results.query));

  const shown = useMemo(() => {
    if (!results) return [];
    const list = results.records
      .filter((r) => typeFilter === "all" || r.itemType === typeFilter)
      .filter((r) => !exactOnly || isExact(r));
    return [...list.filter(isExact), ...list.filter((r) => !isExact(r))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, exactOnly, typeFilter]);

  const suggestions =
    results && results.mode === "name" && results.total === 0 ? nameVariants(results.query).slice(1) : [];

  return (
    <Stack spacing={3}>
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2, md: 3 },
        }}
      >
        <Typography variant="h6" sx={{ mb: 2 }}>
          Tra cứu thành phần
        </Typography>

        <Box component="form" onSubmit={onSubmit}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}>
            <ToggleButtonGroup
              exclusive
              value={mode}
              onChange={(_, v) => {
                if (v) {
                  setMode(v);
                  setError("");
                }
              }}
              size="small"
              sx={{
                flexShrink: 0,
                height: 40,
                bgcolor: "background.paper",
                "& .MuiToggleButton-root": { flex: { xs: 1, md: "none" }, whiteSpace: "nowrap" },
              }}
            >
              <ToggleButton value="name" sx={{ px: 2 }}>
                <TextFieldsRounded fontSize="small" sx={{ mr: 0.75 }} /> Theo tên
              </ToggleButton>
              <ToggleButton value="code" sx={{ px: 2 }}>
                <TagRounded fontSize="small" sx={{ mr: 0.75 }} /> Theo mã CAS / EC
              </ToggleButton>
            </ToggleButtonGroup>
            <TextField
              fullWidth
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setError("");
              }}
              placeholder={mode === "name" ? "Tên INCI, tên hoá học, INN…" : "vd. 69-72-7 hoặc 200-712-3"}
              inputProps={{ "aria-label": "Từ khoá tìm kiếm" }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRounded />
                  </InputAdornment>
                ),
                sx: { height: 40 },
              }}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={loading || !trimmed}
              sx={{ height: 40, minWidth: 120, flexShrink: 0 }}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              Tìm kiếm
            </Button>
          </Stack>
        </Box>

        {codeError && (
          <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 0.75 }}>
            {codeError}
          </Typography>
        )}

        {mode === "name" && looksLikeCode && (
          <Alert
            severity="info"
            sx={{ mt: 1 }}
            action={
              <Button color="inherit" size="small" onClick={() => run("code", trimmed)}>
                Tìm theo mã
              </Button>
            }
          >
            Có vẻ đây là mã CAS/EC.
          </Alert>
        )}

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
          {recent.length > 0 ? (
            <>
              <HistoryRounded fontSize="small" color="action" />
              {recent.map((r) => (
                <Chip
                  key={r.mode + r.q}
                  size="small"
                  label={r.q}
                  icon={r.mode === "code" ? <TagRounded /> : undefined}
                  onClick={() => run(r.mode, r.q)}
                  onDelete={() => {
                    const next = recent.filter((x) => x !== r);
                    setRecent(next);
                    saveRecent(next);
                  }}
                  sx={{ bgcolor: "background.paper" }}
                />
              ))}
            </>
          ) : (
            <>
              <Typography variant="caption" color="text.secondary">
                Thử:
              </Typography>
              {EXAMPLES[mode].map((q) => (
                <Chip key={q} size="small" label={q} onClick={() => run(mode, q)} sx={{ bgcolor: "background.paper" }} />
              ))}
            </>
          )}
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {loading && !results && (
        <Stack spacing={1.5}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={84} />
          ))}
        </Stack>
      )}

      {results && (
        <Box sx={{ opacity: loading ? 0.5 : 1, transition: "opacity .2s" }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ sm: "center" }}
            spacing={1}
            sx={{ mb: 1.5 }}
          >
            <Typography variant="subtitle1">
              {results.total} kết quả cho{" "}
              <Box component="span" color="primary.main">
                “{results.query}”
              </Box>
              {results.total > results.records.length && (
                <Typography component="span" variant="body2" color="text.secondary">
                  {" "}
                  · hiển thị {results.records.length} mục đầu
                </Typography>
              )}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={typeFilter}
                onChange={(_, v) => v && setTypeFilter(v)}
              >
                <ToggleButton value="all">Tất cả</ToggleButton>
                <ToggleButton value="ingredient">Ingredient</ToggleButton>
                <ToggleButton value="substance">Substance</ToggleButton>
              </ToggleButtonGroup>
              {results.mode === "name" && (
                <FormControlLabel
                  control={<Switch size="small" checked={exactOnly} onChange={(e) => setExactOnly(e.target.checked)} />}
                  label={<Typography variant="body2">Chỉ khớp chính xác</Typography>}
                  sx={{ ml: 1 }}
                />
              )}
            </Stack>
          </Stack>

          {shown.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 5, textAlign: "center" }}>
              <Typography variant="subtitle1">Không có kết quả phù hợp</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {results.mode === "code"
                  ? "Không có mục nào trong CosIng ghi mã này."
                  : "Kiểm tra lại chính tả hoặc bỏ bớt phần trong ngoặc."}
              </Typography>
              {suggestions.length > 0 && (
                <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
                  <Typography variant="body2" color="text.secondary">
                    Thử tìm:
                  </Typography>
                  {suggestions.map((s) => (
                    <Chip key={s} label={s} size="small" color="primary" variant="outlined" onClick={() => run("name", s)} />
                  ))}
                </Stack>
              )}
            </Paper>
          ) : (
            <Stack spacing={1.25}>
              {shown.map((rec) => (
                <ResultRow key={rec.id} rec={rec} exact={isExact(rec)} onOpen={() => setSelected(rec)} />
              ))}
            </Stack>
          )}
        </Box>
      )}

      <DetailDrawer record={selected} onClose={() => setSelected(null)} />
    </Stack>
  );
}
