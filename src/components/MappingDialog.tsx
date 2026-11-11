import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
  useMediaQuery,
} from "@mui/material";
import type { Theme } from "@mui/material/styles";
import {
  cellText,
  colLetter,
  columnCount,
  detectMapping,
  extractIngredients,
  Mapping,
  Sheet,
} from "../lib/excel";
import { InputIngredient } from "../lib/batch";

type ColKey = "nameCol" | "casCol" | "pctCol" | "fnCol";
const ROLES: { key: ColKey; label: string; optional: boolean }[] = [
  { key: "nameCol", label: "Cột tên thành phần", optional: false },
  { key: "casCol", label: "Cột mã CAS", optional: true },
  { key: "pctCol", label: "Cột nồng độ %", optional: true },
  { key: "fnCol", label: "Cột chức năng", optional: true },
];

const range = (a: number, b: number) =>
  Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => Math.min(a, b) + i);

/**
 * One preview row. Plain HTML (no MUI cells) and memoised, so ticking a row
 * re-renders only that row even on sheets with thousands of lines.
 */
const PreviewRow = memo(function PreviewRow({
  r,
  cells,
  checked,
  bold,
  onToggle,
}: {
  r: number;
  cells: string[];
  checked: boolean;
  bold: boolean;
  onToggle: (r: number, shift: boolean) => void;
}) {
  return (
    <tr data-row={r} className={checked ? "on" : undefined} onClick={(e) => onToggle(r, e.shiftKey)}>
      <td className="chk">
        <input type="checkbox" checked={checked} readOnly tabIndex={-1} aria-label={`Dòng ${r + 1}`} />
      </td>
      <td className="num">{r + 1}</td>
      {cells.map((t, c) => (
        <td key={c} title={t} className={bold ? "bold" : undefined}>
          {t}
        </td>
      ))}
    </tr>
  );
});

const tableSx = {
  flex: 1,
  overflow: "auto",
  border: 1,
  borderColor: "divider",
  borderRadius: 1,
  "& table": { borderCollapse: "collapse", width: "100%", fontSize: 13.5 },
  "& th": {
    position: "sticky",
    top: 0,
    zIndex: 1,
    bgcolor: "#f8fafc",
    textAlign: "left",
    fontWeight: 600,
    fontSize: 12,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    whiteSpace: "nowrap",
    px: 1.5,
    py: 1,
    borderBottom: 1,
    borderColor: "divider",
  },
  "& th.role": { color: "primary.main" },
  "& td": {
    px: 1.5,
    py: 0.75,
    borderBottom: 1,
    borderColor: "divider",
    maxWidth: 280,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  "& td.bold": { fontWeight: 700 },
  "& td.num": { color: "text.secondary", width: 48 },
  "& .chk": { width: 40, pr: 0 },
  "& input[type=checkbox]": { width: 16, height: 16, accentColor: "#0d7a6f", cursor: "pointer", m: 0 },
  "& tbody tr": { cursor: "pointer", userSelect: "none" },
  "& tbody tr:hover": { bgcolor: "action.hover" },
  "& tbody tr.on": { bgcolor: "rgba(13,122,111,.07)" },
} as const;

export default function MappingDialog({
  open,
  fileName,
  sheets,
  onClose,
  onConfirm,
}: {
  open: boolean;
  fileName: string;
  sheets: Sheet[];
  onClose: () => void;
  onConfirm: (items: InputIngredient[]) => void;
}) {
  const [sheetIndex, setSheetIndex] = useState(0);
  const sheet = sheets[sheetIndex];
  const [m, setM] = useState<Mapping | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const lastClicked = useRef<number | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const isPhone = useMediaQuery((t: Theme) => t.breakpoints.down("sm"));

  useEffect(() => {
    setSheetIndex(0);
  }, [sheets]);

  useEffect(() => {
    if (!sheet) return;
    const detected = detectMapping(sheet.rows);
    setM(detected);
    // Pre-tick every detected ingredient row (all product blocks).
    setSelected(new Set(detected.rows));
    lastClicked.current = null;
    requestAnimationFrame(() =>
      tableRef.current
        ?.querySelector(`[data-row="${Math.max(0, detected.startRow - 2)}"]`)
        ?.scrollIntoView({ block: "start" })
    );
  }, [sheet]);

  const cols = sheet ? columnCount(sheet.rows) : 0;
  // Cell text computed once per sheet, not on every tick.
  const texts = useMemo(
    () => (sheet ? sheet.rows.map((row) => Array.from({ length: cols }, (_, c) => cellText(row[c]))) : []),
    [sheet, cols]
  );

  /** Click toggles one row; Shift+click applies that state to the whole range. */
  const toggle = useCallback((r: number, shift: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const on = !prev.has(r);
      const rows = shift && lastClicked.current !== null ? range(lastClicked.current, r) : [r];
      rows.forEach((i) => (on ? next.add(i) : next.delete(i)));
      return next;
    });
    lastClicked.current = r;
  }, []);

  const allRef = useRef<HTMLInputElement>(null);
  const items = useMemo(
    () => (sheet && m ? extractIngredients(sheet.rows, m, selected) : []),
    [sheet, m, selected]
  );

  if (!sheet || !m) return null;

  const total = sheet.rows.length;
  const allOn = selected.size === total;
  const products = new Set(Object.values(m.groupByRow)).size;
  const titleRows = new Set(m.skipRows);
  if (allRef.current) allRef.current.indeterminate = selected.size > 0 && !allOn;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      fullScreen={isPhone}
      PaperProps={{ sx: { height: isPhone ? "100%" : "88vh" } }}
    >
      <DialogTitle>
        Chọn vùng dữ liệu
        <Typography variant="body2" color="text.secondary">
          {fileName}
          {products > 1 ? ` · nhận diện ${products} sản phẩm` : ""} · tick các dòng cần kiểm tra (giữ Shift để
          chọn nhiều dòng liền nhau)
        </Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(auto-fill, minmax(170px, 1fr))" } }}>
          {sheets.length > 1 && (
            <FormControl size="small">
              <InputLabel>Sheet</InputLabel>
              <Select label="Sheet" value={sheetIndex} onChange={(e) => setSheetIndex(Number(e.target.value))}>
                {sheets.map((s, i) => (
                  <MenuItem key={s.name} value={i}>
                    {s.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {ROLES.map((role) => (
            <FormControl key={role.key} size="small">
              <InputLabel>{role.label}</InputLabel>
              <Select
                label={role.label}
                value={m[role.key]}
                onChange={(e) => setM({ ...m, [role.key]: Number(e.target.value) })}
                renderValue={(v) => (Number(v) < 0 ? "Không dùng" : `Cột ${colLetter(Number(v))}`)}
              >
                {role.optional && <MenuItem value={-1}>Không dùng</MenuItem>}
                {Array.from({ length: cols }, (_, c) => (
                  <MenuItem key={c} value={c}>
                    Cột {colLetter(c)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ))}
        </Box>

        <Box ref={tableRef} sx={tableSx}>
          <table>
            <thead>
              <tr>
                <th className="chk">
                  <input
                    ref={allRef}
                    type="checkbox"
                    checked={allOn}
                    aria-label="Chọn tất cả"
                    onChange={() =>
                      startTransition(() => setSelected(allOn ? new Set() : new Set(range(0, total - 1))))
                    }
                  />
                </th>
                <th>Dòng</th>
                {Array.from({ length: cols }, (_, c) => {
                  const role = ROLES.find((r) => m[r.key] === c);
                  return (
                    <th key={c} className={role ? "role" : undefined}>
                      {colLetter(c)}
                      {role ? ` · ${role.label.replace("Cột ", "")}` : ""}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {texts.map((cells, r) => (
                <PreviewRow
                  key={r}
                  r={r}
                  cells={cells}
                  checked={selected.has(r)}
                  bold={titleRows.has(r)}
                  onToggle={toggle}
                />
              ))}
            </tbody>
          </table>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 1.5, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mr: "auto", width: { xs: "100%", sm: "auto" } }}>
          Đã chọn {selected.size} dòng · {items.length} thành phần
          {products > 1 ? ` · ${new Set(items.map((i) => i.group)).size} sản phẩm` : ""}
        </Typography>
        <Button onClick={onClose}>Huỷ</Button>
        <Button variant="contained" disabled={!items.length || m.nameCol < 0} onClick={() => onConfirm(items)}>
          Kiểm tra {items.length} thành phần
        </Button>
      </DialogActions>
    </Dialog>
  );
}
