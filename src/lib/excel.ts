import * as XLSX from "xlsx";
import { COSING_DETAIL_URL, formatAnnexRefs, splitRegistryNumbers } from "./cosing";
import { CheckedIngredient, InputIngredient } from "./batch";

export type Cell = string | number | boolean | null | undefined;
export interface Sheet {
  name: string;
  rows: Cell[][];
}

export interface Mapping {
  /** First detected block, 0-based, inclusive. */
  startRow: number;
  endRow: number;
  nameCol: number;
  casCol: number; // -1 = none
  pctCol: number; // -1 = none
  fnCol: number; // -1 = none
  /** Every detected ingredient row, across all product blocks. */
  rows: number[];
  /** Product name for each ingredient row, when the sheet holds several. */
  groupByRow: Record<number, string>;
  /** Header and product-title rows: never read as ingredients. */
  skipRows: number[];
}

export async function readWorkbook(file: File): Promise<Sheet[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  return wb.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[name], {
      header: 1,
      blankrows: true,
      defval: null,
      raw: true,
    }),
  })).filter((s) => s.rows.some((r) => r.some((c) => c !== null && c !== "")));
}

export const cellText = (c: Cell) =>
  c === null || c === undefined ? "" : String(c).replace(/\s+/g, " ").trim();

export const columnCount = (rows: Cell[][]) =>
  rows.reduce((m, r) => Math.max(m, r.length), 0);

/** Excel-style column letter: 0 → A, 27 → AB. */
export const colLetter = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

const HEADER = {
  name: /(inci|ingredient|thành phần|thanh phan|tên|name|nguyên liệu|material)/i,
  cas: /\bcas\b/i,
  pct: /(%|w\/w|percent|tỉ lệ|tỷ lệ|nồng độ|concentration|content)/i,
  fn: /(function|chức năng|công dụng)/i,
};

const isEndRow = (name: string) => !name || /^(total|tổng|sum)\b/i.test(name);

/** Guess where the ingredient table is on a formula sheet. */
export function detectMapping(rows: Cell[][]): Mapping {
  const cols = columnCount(rows);
  let header = -1;
  let nameCol = -1;
  let casCol = -1;
  let pctCol = -1;
  let fnCol = -1;

  for (let r = 0; r < Math.min(rows.length, 60) && header < 0; r++) {
    const cells = rows[r].map(cellText);
    const n = cells.findIndex((c) => c.length < 60 && HEADER.name.test(c) && !HEADER.cas.test(c));
    const c = cells.findIndex((c) => c.length < 40 && HEADER.cas.test(c));
    if (n >= 0 && (c >= 0 || cells.filter(Boolean).length >= 2)) {
      header = r;
      nameCol = n;
      casCol = c;
      pctCol = cells.findIndex((x, i) => i !== n && i !== c && x.length < 30 && HEADER.pct.test(x));
      fnCol = cells.findIndex((x) => HEADER.fn.test(x));
    }
  }

  if (header < 0) {
    // No header: the CAS column has the most CAS-looking cells, the name
    // column the most text cells.
    const score = (col: number, test: (s: string) => boolean) =>
      rows.reduce((acc, r) => acc + (test(cellText(r[col])) ? 1 : 0), 0);
    let best = -1;
    for (let c = 0; c < cols; c++) {
      const s = score(c, (t) => splitRegistryNumbers(t).length > 0);
      if (s > best && s > 0) {
        best = s;
        casCol = c;
      }
    }
    best = -1;
    for (let c = 0; c < cols; c++) {
      if (c === casCol) continue;
      const s = score(c, (t) => /[a-z]{3}/i.test(t) && t.length < 120);
      if (s > best) {
        best = s;
        nameCol = c;
      }
    }
    nameCol = Math.max(nameCol, 0);
  }

  const selected: number[] = [];
  const groupByRow: Record<number, string> = {};
  const skipRows: number[] = [];

  if (pctCol >= 0) {
    // Formula sheets often stack several products, each with a title row and
    // a header that is not always spelled the same ("INGREDIENT NAME",
    // "Ingredient", or none at all). So read the whole sheet row by row:
    // a row with a name and a value in the % column is an ingredient; a row
    // with text but no % is a product title or a header.
    let title = "";
    for (let r = 0; r < rows.length; r++) {
      const name = cellText(rows[r]?.[nameCol]);
      if (isEndRow(name)) continue;
      const pct = cellText(rows[r]?.[pctCol]);
      const looksHeader = name.length < 40 && HEADER.name.test(name);
      if (/\d/.test(pct) && !looksHeader) {
        selected.push(r);
        if (title) groupByRow[r] = title;
      } else {
        skipRows.push(r);
        if (!looksHeader && name.length < 150) title = name;
      }
    }
    // One product only: no grouping needed.
    if (new Set(Object.values(groupByRow)).size < 2)
      for (const k of Object.keys(groupByRow)) delete groupByRow[Number(k)];
  } else {
    // No % column: take the block under the header.
    let start = header + 1;
    while (start < rows.length && !cellText(rows[start]?.[nameCol])) start++;
    for (let r = start; r < rows.length && !isEndRow(cellText(rows[r]?.[nameCol])); r++) selected.push(r);
    if (header >= 0) skipRows.push(header);
  }

  const startRow = selected[0] ?? 0;
  let endRow = startRow;
  while (selected.includes(endRow + 1)) endRow++;
  return { startRow, endRow, nameCol, casCol, pctCol, fnCol, rows: selected, groupByRow, skipRows };
}

const toNumber = (c: Cell): number | undefined => {
  if (typeof c === "number") return c;
  const s = cellText(c).replace("%", "").replace(",", ".");
  const n = parseFloat(s);
  return s && !Number.isNaN(n) ? n : undefined;
};

/**
 * Read ingredients from the sheet: the rows ticked in `selected` when given,
 * otherwise the range startRow..endRow of the mapping.
 */
export function extractIngredients(
  rows: Cell[][],
  m: Mapping,
  selected?: Iterable<number>
): InputIngredient[] {
  const indices = Array.from(selected ?? m.rows).sort((a, b) => a - b);
  const skip = new Set(m.skipRows);
  // Product name for rows ticked by hand: the block the row falls in.
  const groupStarts = Object.keys(m.groupByRow)
    .map(Number)
    .sort((a, b) => a - b);
  const groupFor = (r: number) => {
    if (m.groupByRow[r]) return m.groupByRow[r];
    let g: string | undefined;
    for (const s of groupStarts) {
      if (s > r) break;
      g = m.groupByRow[s];
    }
    return g;
  };
  const out: InputIngredient[] = [];
  for (const r of indices) {
    if (r >= rows.length || skip.has(r)) continue;
    const row = rows[r] ?? [];
    const name = cellText(row[m.nameCol]);
    const cas = m.casCol >= 0 ? cellText(row[m.casCol]) : "";
    if (!name && !cas) continue;
    if (/^(total|tổng)\b/i.test(name)) continue;
    out.push({
      source: r + 1,
      name,
      cas,
      percentage: m.pctCol >= 0 ? toNumber(row[m.pctCol]) : undefined,
      function: m.fnCol >= 0 ? cellText(row[m.fnCol]) : undefined,
      group: groupFor(r),
    });
  }
  return out;
}

const VERDICT_TEXT: Record<string, string> = {
  prohibited: "Bị cấm (Annex II)",
  restricted: "Hạn chế (Annex III)",
  listed: "Có điều kiện (Annex IV/V/VI)",
  clear: "Không hạn chế",
  review: "Cần xem lại",
  notfound: "Không tìm thấy",
  error: "Lỗi tra cứu",
};

export function exportResults(rows: CheckedIngredient[], fileName: string) {
  const hasGroups = rows.some((r) => r.group);
  const data = rows.map((r, i) => {
    const best = r.matches[0] ?? r.candidates[0];
    const refs = r.matches.flatMap((m) => m.annexRefs);
    return {
      STT: i + 1,
      ...(hasGroups ? { "Sản phẩm": r.group ?? "" } : {}),
      "Dòng gốc": r.source,
      "Tên trong file": r.name,
      "CAS trong file": r.cas,
      "%": r.percentage ?? "",
      "Kết quả": r.state === "error" ? VERDICT_TEXT.error : VERDICT_TEXT[r.verdict ?? "notfound"],
      "Khớp theo": r.matchedBy.map((m) => (m === "name" ? "Tên" : "CAS")).join(" + "),
      "INCI (CosIng)": r.matches.map((m) => m.inciName).join("; ") || (best ? `(gần giống) ${best.inciName}` : ""),
      "CAS (CosIng)": Array.from(new Set(r.matches.flatMap((m) => m.casNumbers))).join(", "),
      "EC (CosIng)": Array.from(new Set(r.matches.flatMap((m) => m.ecNumbers))).join(", "),
      "Annex/Ref": formatAnnexRefs(refs.filter((a, j) => refs.findIndex((b) => b.annex === a.annex && b.ref === a.ref) === j)),
      "Chức năng": Array.from(new Set(r.matches.flatMap((m) => m.functions))).join(", "),
      "Hạn chế khác": Array.from(new Set(r.matches.flatMap((m) => m.otherRestrictions))).join("; "),
      "Ghi chú": [...r.warnings, r.error].filter(Boolean).join("; "),
      "Link CosIng": best ? COSING_DETAIL_URL(best.id) : "",
    };
  });
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [5, ...(hasGroups ? [36] : []), 8, 36, 14, 8, 24, 10, 36, 16, 16, 14, 40, 40, 40, 52].map((wch) => ({ wch }));
  ws["!autofilter"] = { ref: ws["!ref"] as string };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "CosIng");
  XLSX.writeFile(wb, fileName);
}
