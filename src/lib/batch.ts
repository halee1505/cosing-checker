import {
  CosingRecord,
  isRegistryNumber,
  isValidCas,
  CAS_RE,
  sameName,
  searchByName,
  searchByNumber,
  splitRegistryNumbers,
  Verdict,
  verdictFor,
} from "./cosing";

/** One ingredient line from a formula sheet or a pasted list. */
export interface InputIngredient {
  /** Row number in the source (1-based), for traceability. */
  source: number;
  name: string;
  cas: string;
  percentage?: number;
  function?: string;
  /** Product the row belongs to, when one file holds several products. */
  group?: string;
}

export type BatchMode = "auto" | "name" | "cas";

export interface CheckedIngredient extends InputIngredient {
  key: string;
  /** Position in the checked list (stable, used for numbering). */
  index: number;
  state: "pending" | "loading" | "done" | "error";
  verdict?: Verdict;
  /** Records that match the name or the CAS exactly. */
  matches: CosingRecord[];
  /** Other hits for the query (fuzzy), shown when nothing matched exactly. */
  candidates: CosingRecord[];
  matchedBy: ("name" | "cas")[];
  usedQuery?: string;
  error?: string;
  warnings: string[];
}

export function makeRow(input: InputIngredient, index: number): CheckedIngredient {
  const warnings: string[] = [];
  const cas = input.cas.trim();
  const numbers = splitRegistryNumbers(cas);
  if (cas && !numbers.length) warnings.push("Ô CAS không chứa mã CAS/EC hợp lệ");
  for (const n of numbers)
    if (CAS_RE.test(n) && !isValidCas(n))
      warnings.push(`CAS ${n} sai chữ số kiểm tra`);
  return {
    ...input,
    key: `${index}-${input.name}-${cas}`,
    index,
    state: "pending",
    matches: [],
    candidates: [],
    matchedBy: [],
    warnings,
  };
}

const dedupe = (records: CosingRecord[]) => {
  const seen = new Map<string, CosingRecord>();
  for (const r of records) if (!seen.has(r.id)) seen.set(r.id, r);
  return Array.from(seen.values());
};

/** Look one ingredient up in CosIng and classify it. */
export async function checkIngredient(
  row: CheckedIngredient,
  mode: BatchMode,
  signal?: AbortSignal
): Promise<CheckedIngredient> {
  const numbers = splitRegistryNumbers(row.cas).filter(isRegistryNumber);
  const useName = mode !== "cas" && row.name.trim().length > 0;
  const useCas = mode !== "name" && numbers.length > 0;

  if (!useName && !useCas) {
    return {
      ...row,
      state: "done",
      verdict: "notfound",
      error:
        mode === "cas" ? "Dòng này không có mã CAS hợp lệ" : "Dòng này không có tên",
    };
  }

  const [byName, ...byCas] = await Promise.all([
    useName ? searchByName(row.name, signal) : Promise.resolve(null),
    ...(useCas ? numbers.map((n) => searchByNumber(n, signal)) : []),
  ]);

  const nameHits = byName?.records ?? [];
  const casHits = byCas.flatMap((r) => r?.records ?? []);

  // A hit on a slash fragment ("Lactobacillus" from "Lactobacillus/Rye Flour
  // Ferment") is only a suggestion, never an exact match.
  const nameExact = nameHits.filter(
    (r) => sameName(r, row.name) || (byName && !byName.weak && sameName(r, byName.usedQuery))
  );
  const matchedBy: ("name" | "cas")[] = [];
  if (nameExact.length) matchedBy.push("name");
  if (casHits.length) matchedBy.push("cas");

  const matches = dedupe([...nameExact, ...casHits]);
  const candidates = dedupe(nameHits.filter((r) => !matches.includes(r)));

  let verdict: Verdict;
  if (matches.length) verdict = verdictFor(matches);
  else verdict = candidates.length ? "review" : "notfound";

  const warnings = [...row.warnings];
  if (
    useName &&
    useCas &&
    nameExact.length &&
    casHits.length &&
    !nameExact.some((r) => casHits.some((c) => c.id === r.id))
  ) {
    warnings.push("Tên và mã CAS trỏ tới hai mục khác nhau trong CosIng");
  }

  return {
    ...row,
    state: "done",
    verdict,
    matches,
    candidates,
    matchedBy,
    usedQuery: byName?.usedQuery,
    warnings,
  };
}

/** Run `task` over `items` with at most `limit` in flight. */
export async function runPool<T>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<void>,
  signal?: AbortSignal
) {
  let next = 0;
  const worker = async () => {
    while (next < items.length && !signal?.aborted) {
      const i = next++;
      await task(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/**
 * Parse a pasted ingredient list. Accepts:
 *  - one ingredient per line, optionally "name<TAB>CAS" or "name ; CAS"
 *  - a packaging INCI list on one line: "Water, Glycerin, 1,2-Hexanediol"
 *    (split on comma + space so "1,2-Hexanediol" stays whole)
 */
export function parsePastedList(text: string): InputIngredient[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // A single line with ", " is a packaging INCI list; otherwise one per line.
  const parts =
    lines.length === 1 && /,\s/.test(lines[0]) && !/\t/.test(lines[0])
      ? lines[0].split(/,\s+/)
      : lines;

  return parts
    .map((part, i) => {
      // Cells: tab, ";" or ", " followed by a number ("Glycerin, 56-81-5").
      const cells = part
        .split(/\t|;|,\s+(?=\d)/)
        .map((c) => c.trim())
        .filter(Boolean);
      const casCell = cells.find((c, idx) => idx > 0 && splitRegistryNumbers(c).length);
      let name = cells[0] ?? "";
      let cas = casCell ?? "";
      // "Glycerin 56-81-5" → split trailing number off the name.
      if (!cas) {
        const m = name.match(/^(.*?)[\s(]+(\d{2,7}-\d{2,3}-\d)\)?$/);
        if (m) {
          name = m[1];
          cas = m[2];
        }
      }
      if (isRegistryNumber(name) && !cas) {
        cas = name;
        name = "";
      }
      const pct = cells.find((c) => /^\d+([.,]\d+)?\s*%?$/.test(c) && c !== cas);
      return {
        source: i + 1,
        name: name.replace(/[.;]+$/, "").trim(),
        cas,
        percentage: pct ? parseFloat(pct.replace(",", ".")) : undefined,
      };
    })
    .filter((r) => r.name || r.cas);
}

export function summarize(rows: CheckedIngredient[]) {
  const counts: Record<Verdict | "pending", number> = {
    prohibited: 0,
    restricted: 0,
    listed: 0,
    clear: 0,
    review: 0,
    notfound: 0,
    error: 0,
    pending: 0,
  };
  for (const r of rows) {
    if (r.state === "error") counts.error++;
    else if (r.state !== "done" || !r.verdict) counts.pending++;
    else counts[r.verdict]++;
  }
  return counts;
}
