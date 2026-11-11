import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  Alert,
  Backdrop,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import type { Theme } from "@mui/material/styles";
import UploadFileRounded from "@mui/icons-material/UploadFileRounded";
import ContentPasteRounded from "@mui/icons-material/ContentPasteRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import ReplayRounded from "@mui/icons-material/ReplayRounded";
import StopRounded from "@mui/icons-material/StopRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import KeyboardArrowDownRounded from "@mui/icons-material/KeyboardArrowDownRounded";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import CloseRounded from "@mui/icons-material/CloseRounded";
import {
  BatchMode,
  CheckedIngredient,
  checkIngredient,
  InputIngredient,
  makeRow,
  parsePastedList,
  runPool,
  summarize,
} from "../lib/batch";
import { CosingRecord, formatAnnexRefs, Verdict, VERDICT_ORDER } from "../lib/cosing";
import { exportResults, readWorkbook, Sheet } from "../lib/excel";
import MappingDialog from "../components/MappingDialog";
import DetailDrawer from "../components/DetailDrawer";
import { AnnexChips, StatusChip, VERDICT_META } from "../components/StatusChip";

const CONCURRENCY = 4;
const PAGE = 300;

const MODES: { value: BatchMode; label: string; hint: string }[] = [
  { value: "auto", label: "Tự động (tên + CAS)", hint: "Tìm theo cả tên và mã CAS, gộp kết quả" },
  { value: "name", label: "Chỉ theo tên", hint: "Bỏ qua cột CAS" },
  { value: "cas", label: "Chỉ theo mã CAS", hint: "Bỏ qua tên, chỉ dòng có CAS hợp lệ" },
];

const PASTE_EXAMPLE = `Aqua, Glycerin, Niacinamide, Butylene Glycol, 1,2-Hexanediol, Salicylic Acid, Phenoxyethanol, Parfum`;

function SummaryChip({
  verdict,
  count,
  active,
  onClick,
}: {
  verdict: Verdict;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const meta = VERDICT_META[verdict];
  return (
    <Chip
      icon={meta.icon}
      label={`${meta.label}: ${count}`}
      color={meta.color}
      variant={active ? "filled" : "outlined"}
      disabled={!count}
      onClick={onClick}
    />
  );
}

const ResultTableRow = memo(function ResultTableRow({
  row,
  onOpen,
  onRetry,
}: {
  row: CheckedIngredient;
  onOpen: (rec: CosingRecord, pct?: number) => void;
  onRetry: (row: CheckedIngredient) => void;
}) {
  const index = row.index;
  const [open, setOpen] = useState(false);
  const best = row.matches[0];
  const refs = row.matches.flatMap((m) => m.annexRefs);
  const uniqueRefs = refs.filter((a, i) => refs.findIndex((b) => b.annex === a.annex && b.ref === a.ref) === i);
  const expandable = row.matches.length > 1 || row.candidates.length > 0 || row.warnings.length > 0 || !!row.error;
  const verdict: Verdict | undefined = row.state === "error" ? "error" : row.verdict;
  const differentName = best && best.inciName.toLowerCase() !== row.name.toLowerCase();

  return (
    <Fragment>
      <TableRow
        hover
        onClick={() => (best ? onOpen(best, row.percentage) : expandable && setOpen(!open))}
        sx={{ cursor: best || expandable ? "pointer" : "default", "& > td": { borderBottom: open ? 0 : undefined } }}
      >
        <TableCell sx={{ color: "text.secondary", fontVariantNumeric: "tabular-nums", width: 48 }}>{index + 1}</TableCell>
        <TableCell sx={{ minWidth: 220 }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Typography variant="body2" fontWeight={600}>
              {row.name || <i>(không có tên)</i>}
            </Typography>
            {row.warnings.length > 0 && (
              <Tooltip title={row.warnings.join(" · ")}>
                <WarningAmberRounded color="warning" sx={{ fontSize: 16 }} />
              </Tooltip>
            )}
          </Stack>
          {differentName && (
            <Typography variant="caption" color="text.secondary">
              → {best.inciName}
              {row.matches.length > 1 ? ` +${row.matches.length - 1} mục` : ""}
            </Typography>
          )}
        </TableCell>
        <TableCell sx={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13, whiteSpace: "nowrap" }}>
          {row.cas || <Typography component="span" color="text.disabled">—</Typography>}
        </TableCell>
        <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
          {row.percentage !== undefined ? `${+row.percentage.toPrecision(4)}` : "—"}
        </TableCell>
        <TableCell sx={{ minWidth: 150 }}>
          {row.state === "loading" || row.state === "pending" ? (
            <LinearProgress sx={{ width: 90, borderRadius: 1, opacity: row.state === "pending" ? 0.3 : 1 }} />
          ) : verdict ? (
            <StatusChip verdict={verdict} />
          ) : null}
        </TableCell>
        <TableCell>
          <AnnexChips refs={uniqueRefs} />
        </TableCell>
        <TableCell sx={{ whiteSpace: "nowrap" }}>
          {row.matchedBy.map((m) => (
            <Chip key={m} size="small" variant="outlined" label={m === "name" ? "Tên" : "CAS"} sx={{ mr: 0.5, height: 22 }} />
          ))}
        </TableCell>
        <TableCell align="right" sx={{ width: 88, whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
          {row.state === "error" && (
            <Tooltip title="Thử lại">
              <IconButton size="small" onClick={() => onRetry(row)}>
                <ReplayRounded fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {expandable && (
            <IconButton size="small" onClick={() => setOpen(!open)} aria-label="Chi tiết">
              <KeyboardArrowDownRounded
                fontSize="small"
                sx={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}
              />
            </IconButton>
          )}
        </TableCell>
      </TableRow>
      {expandable && (
        <TableRow>
          <TableCell colSpan={8} sx={{ py: 0, bgcolor: "background.default" }}>
            <Collapse in={open} unmountOnExit>
              <Stack spacing={1.25} sx={{ py: 1.75, pl: 6 }}>
                {row.error && <Alert severity="error">{row.error}</Alert>}
                {row.warnings.map((w) => (
                  <Alert key={w} severity="warning" sx={{ py: 0 }}>
                    {w}
                  </Alert>
                ))}
                {row.matches.length > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      Mục khớp
                    </Typography>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                      {row.matches.map((r) => (
                        <Chip
                          key={r.id}
                          label={`${r.inciName}${r.annexRefs.length ? ` · ${formatAnnexRefs(r.annexRefs)}` : ""}`}
                          onClick={() => onOpen(r, row.percentage)}
                          color="primary"
                          variant="outlined"
                          size="small"
                        />
                      ))}
                    </Stack>
                  </Box>
                )}
                {row.candidates.length > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      {row.matches.length ? "Kết quả liên quan khác" : "Có thể bạn muốn tìm"}
                      {row.usedQuery && row.usedQuery !== row.name ? ` (đã tìm “${row.usedQuery}”)` : ""}
                    </Typography>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                      {row.candidates.slice(0, 12).map((r) => (
                        <Chip
                          key={r.id}
                          label={`${r.inciName}${r.annexRefs.length ? ` · ${formatAnnexRefs(r.annexRefs)}` : ""}`}
                          onClick={() => onOpen(r, row.percentage)}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                      {row.candidates.length > 12 && (
                        <Typography variant="caption" color="text.secondary" alignSelf="center">
                          +{row.candidates.length - 12} mục
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
});

/** Compact card used instead of the table row on phones. */
const ResultCard = memo(function ResultCard({
  row,
  onOpen,
  onRetry,
}: {
  row: CheckedIngredient;
  onOpen: (rec: CosingRecord, pct?: number) => void;
  onRetry: (row: CheckedIngredient) => void;
}) {
  const best = row.matches[0] ?? row.candidates[0];
  const refs = row.matches.flatMap((m) => m.annexRefs);
  const uniqueRefs = refs.filter((a, i) => refs.findIndex((b) => b.annex === a.annex && b.ref === a.ref) === i);
  const verdict: Verdict | undefined = row.state === "error" ? "error" : row.verdict;
  return (
    <Box
      onClick={() => (row.state === "error" ? onRetry(row) : best && onOpen(best, row.percentage))}
      sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider", cursor: best ? "pointer" : "default" }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} sx={{ wordBreak: "break-word" }}>
            {row.index + 1}. {row.name || row.cas}
          </Typography>
          {best && best.inciName.toLowerCase() !== row.name.toLowerCase() && (
            <Typography variant="caption" color="text.secondary" display="block">
              → {best.inciName}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            {[row.cas, row.percentage !== undefined ? `${+row.percentage.toPrecision(4)}%` : ""]
              .filter(Boolean)
              .join(" · ")}
          </Typography>
        </Box>
        <Box sx={{ flexShrink: 0 }}>
          {row.state === "loading" || row.state === "pending" ? (
            <LinearProgress sx={{ width: 60, mt: 1 }} />
          ) : (
            verdict && <StatusChip verdict={verdict} />
          )}
        </Box>
      </Stack>
      {uniqueRefs.length > 0 && (
        <Box sx={{ mt: 0.75 }}>
          <AnnexChips refs={uniqueRefs} />
        </Box>
      )}
    </Box>
  );
});

export default function BatchCheck() {
  const [inputTab, setInputTab] = useState(0);
  const [pasteText, setPasteText] = useState("");
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [fileName, setFileName] = useState("");
  const [mappingOpen, setMappingOpen] = useState(false);
  const [readError, setReadError] = useState("");

  const [sourceLabel, setSourceLabel] = useState("");
  const [inputs, setInputs] = useState<InputIngredient[]>([]);
  const [rows, setRows] = useState<CheckedIngredient[]>([]);
  const [mode, setMode] = useState<BatchMode>("auto");
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<Verdict | null>(null);
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<{ rec: CosingRecord; pct?: number } | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const isPhone = useMediaQuery((t: Theme) => t.breakpoints.down("sm"));

  useEffect(() => () => ctrl.current?.abort(), []);

  const [reading, setReading] = useState("");

  const openFile = async (file: File) => {
    setReadError("");
    setReading(file.name);
    // Parsing blocks the page; wait two frames so the loading overlay shows first.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      const s = await readWorkbook(file);
      if (!s.length) throw new Error("empty");
      setSheets(s);
      setFileName(file.name);
      setMappingOpen(true);
    } catch {
      setReadError(`Không đọc được “${file.name}”. Hãy dùng file .xlsx, .xls hoặc .csv.`);
    } finally {
      setReading("");
    }
  };

  const { getRootProps, getInputProps, isDragActive, open: openPicker } = useDropzone({
    onDrop: (files) => files[0] && openFile(files[0]),
    multiple: false,
    noClick: true,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
  });

  const loadExample = async () => {
    setReading("example.xlsx");
    const res = await fetch(`${process.env.PUBLIC_URL || "."}/example.xlsx`);
    const blob = await res.blob();
    openFile(new File([blob], "example.xlsx"));
  };

  const run = async (targets: CheckedIngredient[], m: BatchMode) => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setRunning(true);
    const keys = new Set(targets.map((t) => t.key));
    setRows((prev) => prev.map((r) => (keys.has(r.key) ? { ...r, state: "pending", error: undefined } : r)));

    // Results are buffered and applied a few times per second, so a file
    // with thousands of rows does not re-render the table for every row.
    const buffer = new Map<string, CheckedIngredient | "loading">();
    const flush = () => {
      if (!buffer.size || c.signal.aborted) return;
      const batch = new Map(buffer);
      buffer.clear();
      setRows((prev) =>
        prev.map((r) => {
          const u = batch.get(r.key);
          if (!u) return r;
          return u === "loading" ? { ...r, state: "loading" } : u;
        })
      );
    };
    const timer = setInterval(flush, 250);

    await runPool(
      targets,
      CONCURRENCY,
      async (row) => {
        buffer.set(row.key, "loading");
        try {
          buffer.set(row.key, await checkIngredient(row, m, c.signal));
        } catch (e: any) {
          if (e?.name === "AbortError") return;
          buffer.set(row.key, { ...row, state: "error", error: e?.message || "Lỗi không xác định" });
        }
      },
      c.signal
    );
    clearInterval(timer);
    flush();
    if (ctrl.current === c) setRunning(false);
  };

  const start = (items: InputIngredient[], label: string, m = mode) => {
    const fresh = items.map(makeRow);
    setInputs(items);
    setSourceLabel(label);
    setRows(fresh);
    setFilter(null);
    setSearch("");
    setProduct("");
    setLimit(PAGE);
    run(fresh, m);
  };

  const stop = () => {
    ctrl.current?.abort();
    setRunning(false);
    setRows((prev) => prev.map((r) => (r.state === "pending" || r.state === "loading" ? { ...r, state: "error", error: "Đã dừng" } : r)));
  };

  const changeMode = (m: BatchMode) => {
    setMode(m);
    if (inputs.length) start(inputs, sourceLabel, m);
  };

  const pasted = useMemo(() => parsePastedList(pasteText), [pasteText]);
  const counts = useMemo(() => summarize(rows), [rows]);
  const finished = rows.length - counts.pending;

  const products = useMemo(
    () => Array.from(new Set(rows.map((r) => r.group).filter((g): g is string => !!g))),
    [rows]
  );
  const productRows = useMemo(() => (product ? rows.filter((r) => r.group === product) : rows), [rows, product]);
  const productCounts = useMemo(() => summarize(productRows), [productRows]);

  const openRecord = useCallback((rec: CosingRecord, pct?: number) => setSelected({ rec, pct }), []);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const retryRow = useCallback((row: CheckedIngredient) => run([row], modeRef.current), []); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = productRows.filter((r) => {
      const v: Verdict | undefined = r.state === "error" ? "error" : r.verdict;
      if (filter && v !== filter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.cas.includes(q) ||
        r.matches.some((m) => m.inciName.toLowerCase().includes(q))
      );
    });
    return list;
  }, [productRows, filter, search]);

  const errorRows = rows.filter((r) => r.state === "error");

  return (
    <Stack spacing={2.5}>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
          <Typography variant="h6" sx={{ mr: "auto" }}>
            Kiểm tra công thức
          </Typography>
          <ToggleButtonGroup exclusive size="small" value={inputTab} onChange={(_, v) => v !== null && setInputTab(v)}>
            <ToggleButton value={0}>
              <UploadFileRounded fontSize="small" sx={{ mr: 0.75 }} /> File Excel
            </ToggleButton>
            <ToggleButton value={1}>
              <ContentPasteRounded fontSize="small" sx={{ mr: 0.75 }} /> Dán danh sách
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        {inputTab === 0 ? (
          <Box
            {...getRootProps()}
            sx={{
              border: "1px dashed",
              borderColor: isDragActive ? "primary.main" : "divider",
              bgcolor: isDragActive ? "action.hover" : "background.default",
              borderRadius: 2,
              py: 3,
              px: 2,
              textAlign: "center",
            }}
          >
            <input {...getInputProps()} />
            <Typography variant="body2" color="text.secondary">
              {isDragActive ? "Thả file vào đây" : "Kéo thả file .xlsx / .xls / .csv vào đây, hoặc"}
            </Typography>
            <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1.5 }}>
              <Button variant="contained" onClick={openPicker} disabled={!!reading}>
                Chọn file
              </Button>
              <Button onClick={loadExample} disabled={!!reading}>
                Dùng file mẫu
              </Button>
            </Stack>
            {readError && (
              <Alert severity="error" sx={{ mt: 2, display: "inline-flex" }}>
                {readError}
              </Alert>
            )}
          </Box>
        ) : (
          <Stack spacing={1.5}>
            <TextField
              multiline
              minRows={4}
              maxRows={14}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={"Mỗi dòng một thành phần (có thể kèm CAS, cách bằng Tab hoặc ;)\nhoặc danh sách INCI trên bao bì:\n" + PASTE_EXAMPLE}
            />
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary" sx={{ mr: "auto" }}>
                {pasted.length ? `${pasted.length} thành phần` : "Có thể copy trực tiếp từ Excel"}
              </Typography>
              {!pasteText && <Button onClick={() => setPasteText(PASTE_EXAMPLE)}>Dùng ví dụ</Button>}
              <Button variant="contained" disabled={!pasted.length} onClick={() => start(pasted, "Danh sách dán")}>
                Kiểm tra
              </Button>
            </Stack>
          </Stack>
        )}
      </Paper>

      {rows.length > 0 && (
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}>
            <Box sx={{ mr: "auto" }}>
              <Typography variant="subtitle1">{sourceLabel}</Typography>
              <Typography variant="body2" color="text.secondary">
                {running ? `Đang tra cứu ${finished}/${rows.length}…` : `${rows.length} thành phần đã kiểm tra`}
              </Typography>
            </Box>
            <TextField
              select
              label="Cách tìm"
              value={mode}
              onChange={(e) => changeMode(e.target.value as BatchMode)}
              sx={{ minWidth: 200 }}
              fullWidth={isPhone}
            >
              {MODES.map((m) => (
                <MenuItem key={m.value} value={m.value}>
                  {m.label}
                </MenuItem>
              ))}
            </TextField>
            {running ? (
              <Button color="inherit" variant="outlined" startIcon={<StopRounded />} onClick={stop}>
                Dừng
              </Button>
            ) : (
              errorRows.length > 0 && (
                <Button variant="outlined" startIcon={<ReplayRounded />} onClick={() => run(errorRows, mode)}>
                  Thử lại {errorRows.length} lỗi
                </Button>
              )
            )}
            <Button
              variant="contained"
              startIcon={<FileDownloadRounded />}
              disabled={running}
              onClick={() =>
                exportResults(rows, `cosing-${(sourceLabel || "ket-qua").replace(/\.[^.]+$/, "")}.xlsx`)
              }
            >
              Xuất Excel
            </Button>
          </Stack>

          {running && (
            <LinearProgress variant="determinate" value={(finished / rows.length) * 100} sx={{ borderRadius: 1, height: 6 }} />
          )}

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {VERDICT_ORDER.filter((v) => v !== "error" || counts.error > 0).map((v) => (
              <SummaryChip
                key={v}
                verdict={v}
                count={productCounts[v]}
                active={filter === v}
                onClick={() => setFilter(filter === v ? null : v)}
              />
            ))}
          </Stack>

          <Paper variant="outlined" sx={{ overflow: "hidden" }}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
              sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}
            >
              <TextField
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Lọc theo tên hoặc CAS…"
                sx={{ width: { xs: "100%", sm: 300 } }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRounded fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              {products.length > 1 && (
                <TextField
                  select
                  value={product}
                  onChange={(e) => {
                    setProduct(e.target.value);
                    setLimit(PAGE);
                  }}
                  sx={{ width: { xs: "100%", sm: "auto" }, minWidth: 220, maxWidth: { sm: 360 } }}
                  SelectProps={{ displayEmpty: true }}
                >
                  <MenuItem value="">Tất cả {products.length} sản phẩm</MenuItem>
                  {products.map((p) => {
                    const c = summarize(rows.filter((r) => r.group === p));
                    const flag = c.prohibited ? " · có chất cấm" : c.restricted ? " · có chất hạn chế" : "";
                    return (
                      <MenuItem key={p} value={p}>
                        {p}
                        {flag}
                      </MenuItem>
                    );
                  })}
                </TextField>
              )}
              {filter && (
                <Chip
                  label={VERDICT_META[filter].label}
                  onDelete={() => setFilter(null)}
                  deleteIcon={<CloseRounded />}
                  color={VERDICT_META[filter].color}
                  size="small"
                />
              )}
              <Typography variant="body2" color="text.secondary" sx={{ ml: "auto !important" }}>
                {visible.length}/{productRows.length} dòng
              </Typography>
            </Stack>
            {isPhone ? (
              <Box>
                {visible.slice(0, limit).map((row, i, arr) => (
                  <Fragment key={row.key}>
                    {!product && row.group && row.group !== arr[i - 1]?.group && (
                      <Typography
                        variant="subtitle2"
                        sx={{ px: 2, py: 1, bgcolor: "background.default", borderBottom: 1, borderColor: "divider" }}
                      >
                        {row.group}
                      </Typography>
                    )}
                    <ResultCard row={row} onOpen={openRecord} onRetry={retryRow} />
                  </Fragment>
                ))}
                {visible.length > limit && (
                  <Box sx={{ textAlign: "center", py: 1.5 }}>
                    <Button onClick={() => setLimit(limit + PAGE)}>Hiển thị thêm ({visible.length - limit})</Button>
                  </Box>
                )}
                {!visible.length && (
                  <Typography sx={{ py: 5, textAlign: "center" }} color="text.secondary">
                    Không có dòng nào khớp bộ lọc
                  </Typography>
                )}
              </Box>
            ) : (
            <TableContainer sx={{ maxHeight: "70vh" }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Thành phần</TableCell>
                    <TableCell>CAS</TableCell>
                    <TableCell align="right">%</TableCell>
                    <TableCell>Kết quả</TableCell>
                    <TableCell>Annex</TableCell>
                    <TableCell>Khớp theo</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visible.slice(0, limit).map((row, i, arr) => (
                    <Fragment key={row.key}>
                      {!product && row.group && row.group !== arr[i - 1]?.group && (
                        <TableRow>
                          <TableCell colSpan={8} sx={{ bgcolor: "background.default", fontWeight: 700, py: 1 }}>
                            {row.group}
                          </TableCell>
                        </TableRow>
                      )}
                      <ResultTableRow row={row} onOpen={openRecord} onRetry={retryRow} />
                    </Fragment>
                  ))}
                  {visible.length > limit && (
                    <TableRow>
                      <TableCell colSpan={8} sx={{ textAlign: "center", py: 1.5 }}>
                        <Button onClick={() => setLimit(limit + PAGE)}>
                          Hiển thị thêm ({visible.length - limit} dòng còn lại)
                        </Button>
                      </TableCell>
                    </TableRow>
                  )}
                  {!visible.length && (
                    <TableRow>
                      <TableCell colSpan={8} sx={{ py: 6, textAlign: "center", color: "text.secondary" }}>
                        Không có dòng nào khớp bộ lọc
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            )}
          </Paper>
          <Typography variant="caption" color="text.secondary">
            Kết quả chỉ để tham khảo, dựa trên dữ liệu CosIng tại thời điểm tra cứu. CosIng không có giá trị pháp lý;
            hãy đối chiếu với văn bản Quy định trên Official Journal trước khi ra quyết định.
          </Typography>
        </Stack>
      )}

      <Backdrop open={!!reading} sx={{ zIndex: (t) => t.zIndex.modal + 1, color: "#fff", flexDirection: "column", gap: 2 }}>
        <CircularProgress color="inherit" />
        <Typography>Đang đọc “{reading}”…</Typography>
      </Backdrop>
      <MappingDialog
        open={mappingOpen}
        fileName={fileName}
        sheets={sheets}
        onClose={() => setMappingOpen(false)}
        onConfirm={(items) => {
          setMappingOpen(false);
          start(items, fileName);
        }}
      />
      <DetailDrawer record={selected?.rec ?? null} percentage={selected?.pct} onClose={() => setSelected(null)} />
    </Stack>
  );
}
