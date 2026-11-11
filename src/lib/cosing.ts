/**
 * Client for the EU CosIng database (the same search API the official
 * CosIng site at ec.europa.eu/growth/tools-databases/cosing uses).
 *
 * The API expects a multipart form with one field, `query`, sent as a JSON
 * *file* (Blob). Sending it as a plain string returns HTTP 500.
 */

const ENDPOINT = "https://webgate.ec.europa.eu/es/search-api/rest/search";
const API_KEY = "285a77fd-1257-4271-8507-f0c6b2961203";
const PAGE_SIZE = 100;

const NAME_FIELDS = [
  "inciName.exact",
  "inciUsaName",
  "innName.exact",
  "phEurName",
  "chemicalName",
  "chemicalDescription",
];

const ITEM_TYPES = { terms: { itemType: ["ingredient", "substance"] } };

export const COSING_DETAIL_URL = (id: string) =>
  `https://ec.europa.eu/growth/tools-databases/cosing/details/${id}`;

export type ItemType = "ingredient" | "substance";

/** One annex reference, e.g. "III/98" → { annex: "III", ref: "98" }. */
export interface AnnexRef {
  annex: string;
  ref: string;
}

export interface CosingRecord {
  id: string;
  itemType: ItemType;
  inciName: string;
  /** Other names: INN, Ph. Eur., chemical name. */
  chemicalName: string;
  innName: string;
  phEurName: string;
  casNumbers: string[];
  ecNumbers: string[];
  /** Raw CAS / EC text as published (may list group members). */
  casRaw: string;
  ecRaw: string;
  functions: string[];
  annexRefs: AnnexRef[];
  /** IDs of linked records (ingredient → annex substances and back). */
  linkedIds: string[];
  maximumConcentration: string;
  conditions: string;
  productTypeBodyParts: string;
  otherRestrictions: string[];
  sccsOpinions: { title: string; url: string }[];
  status: string;
  description: string;
}

export interface SearchResult {
  total: number;
  records: CosingRecord[];
}

export class CosingError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

// ---------------------------------------------------------------- helpers

const ROMAN = ["II", "III", "IV", "V", "VI"];

const clean = (s: unknown) =>
  typeof s === "string" ? s.replace(/\r\n|\r/g, "\n").trim() : "";

const list = (meta: Record<string, unknown>, key: string): string[] => {
  const v = meta[key];
  if (Array.isArray(v)) return v.map(clean).filter((x) => x && x !== "<empty>");
  const s = clean(v);
  return s && s !== "<empty>" ? [s] : [];
};

const first = (meta: Record<string, unknown>, key: string) =>
  list(meta, key)[0] ?? "";

/**
 * Split a published CAS/EC cell into individual numbers.
 * "69-72-7[1]/ 824-35-1[2]" → ["69-72-7", "824-35-1"]
 */
export function splitRegistryNumbers(raw: string): string[] {
  const found = raw.match(/\d{2,7}-\d{2,3}-\d/g) ?? [];
  return Array.from(new Set(found));
}

export const CAS_RE = /^\d{2,7}-\d{2}-\d$/;
export const EC_RE = /^\d{3}-\d{3}-\d$/;

/** Validate a CAS number including its check digit. */
export function isValidCas(cas: string): boolean {
  const s = cas.trim();
  if (!CAS_RE.test(s)) return false;
  const digits = s.replace(/-/g, "");
  const check = Number(digits[digits.length - 1]);
  const body = digits.slice(0, -1).split("").reverse();
  const sum = body.reduce((acc, d, i) => acc + Number(d) * (i + 1), 0);
  return sum % 10 === check;
}

export const isRegistryNumber = (s: string) =>
  CAS_RE.test(s.trim()) || EC_RE.test(s.trim());

/** Parse "III/98\nV/3" or annexNo/refNo pairs into AnnexRef[]. */
export function parseAnnexRefs(text: string): AnnexRef[] {
  const out: AnnexRef[] = [];
  const re = /\b(VI|IV|V|III|II)\s*\/\s*([0-9]+[a-z]?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ annex: m[1].toUpperCase(), ref: m[2] });
  return out;
}

function normalizeRecord(raw: any): CosingRecord {
  const meta: Record<string, unknown> = raw?.metadata ?? {};
  const itemType = (first(meta, "itemType") || "ingredient") as ItemType;
  const casRaw = list(meta, "casNo").join(" / ");
  const ecRaw = list(meta, "ecNo").join(" / ");

  const annexRefs: AnnexRef[] = [];
  const annexNo = first(meta, "annexNo");
  const refNo = first(meta, "refNo");
  if (annexNo && ROMAN.includes(annexNo.toUpperCase()))
    annexRefs.push({ annex: annexNo.toUpperCase(), ref: refNo });
  for (const r of parseAnnexRefs(list(meta, "cosmeticRestriction").join("\n")))
    if (!annexRefs.some((a) => a.annex === r.annex && a.ref === r.ref))
      annexRefs.push(r);

  const sccsTitles = list(meta, "sccsOpinion");
  const sccsUrls = list(meta, "sccsOpinionUrls");

  return {
    id: first(meta, "substanceId") || String(raw?.reference ?? ""),
    itemType,
    inciName:
      first(meta, "inciName") ||
      first(meta, "nameOfCommonIngredientsGlossary") ||
      first(meta, "chemicalName"),
    chemicalName: first(meta, "chemicalName"),
    innName: first(meta, "innName"),
    phEurName: first(meta, "phEurName"),
    casNumbers: splitRegistryNumbers(casRaw),
    ecNumbers: splitRegistryNumbers(ecRaw),
    casRaw,
    ecRaw,
    functions: list(meta, "functionName"),
    annexRefs,
    linkedIds: list(meta, "identifiedIngredient"),
    maximumConcentration: list(meta, "maximumConcentration").join("\n"),
    conditions: list(meta, "wordingOfConditions").join("\n"),
    productTypeBodyParts: list(meta, "productTypeBodyParts").join("\n"),
    otherRestrictions: Array.from(new Set(list(meta, "otherRestrictions"))),
    sccsOpinions: sccsUrls.map((url, i) => ({
      url,
      title: sccsTitles[i] || `SCCS opinion ${i + 1}`,
    })),
    status: first(meta, "status"),
    description: first(meta, "chemicalDescription"),
  };
}

// ---------------------------------------------------------------- transport

const cache = new Map<string, Promise<SearchResult>>();

async function post(query: object, signal?: AbortSignal): Promise<SearchResult> {
  const key = JSON.stringify(query);
  const hit = cache.get(key);
  if (hit) return hit;

  const run = async (): Promise<SearchResult> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await sleep(500 * 2 ** attempt, signal);
      try {
        const form = new FormData();
        form.append(
          "query",
          new Blob([key], { type: "application/json" }),
          "blob"
        );
        const res = await fetch(
          `${ENDPOINT}?apiKey=${API_KEY}&text=*&pageSize=${PAGE_SIZE}&pageNumber=1`,
          { method: "POST", body: form, signal, credentials: "omit" }
        );
        if (!res.ok) {
          lastError = new CosingError(`CosIng trả về lỗi ${res.status}`, res.status);
          if (res.status < 500 && res.status !== 429) break;
          continue;
        }
        const json = await res.json();
        return {
          total: Number(json?.totalResults ?? 0),
          records: Array.isArray(json?.results)
            ? json.results.map(normalizeRecord)
            : [],
        };
      } catch (e) {
        if ((e as Error)?.name === "AbortError") throw e;
        lastError = e;
      }
    }
    throw lastError instanceof CosingError
      ? lastError
      : new CosingError("Không kết nối được tới CosIng");
  };

  const p = run();
  cache.set(key, p);
  // Do not keep failures (or aborted calls) in the cache.
  p.catch(() => cache.delete(key));
  return p;
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

// ---------------------------------------------------------------- queries

/** Raw name search: exactly what CosIng's "Name" box does. */
export function searchByNameRaw(name: string, signal?: AbortSignal) {
  return post(
    {
      bool: {
        must: [
          {
            text: {
              query: name.trim(),
              fields: NAME_FIELDS,
              defaultOperator: "AND",
            },
          },
          ITEM_TYPES,
        ],
      },
    },
    signal
  );
}

/**
 * Candidate spellings for an ingredient name as written on a formula sheet.
 * "Titanium Dioxide (CI 77891)" → ["Titanium Dioxide (CI 77891)",
 * "Titanium Dioxide", "CI 77891"]; "Aqua/Water" → [..., "Aqua", "Water"].
 */
const EU_ALIASES: Record<string, string> = {
  fragrance: "Parfum",
  perfume: "Parfum",
  water: "Aqua",
  flavor: "Aroma",
  flavour: "Aroma",
};

export function nameVariants(name: string): string[] {
  return nameVariantsDetailed(name).map((v) => v.query);
}

/**
 * Like nameVariants, but says which spellings are only fragments.
 * Parenthesised parts are aliases ("Fragrance (Parfum)"), so a hit on them
 * is trustworthy. Slash parts may be synonyms ("Aqua/Water") but also pieces
 * of one INCI name ("Lactobacillus/Rye Flour Ferment"), so a hit on them is
 * only a suggestion.
 */
export function nameVariantsDetailed(name: string): { query: string; weak: boolean }[] {
  const base = name.replace(/\s+/g, " ").trim();
  const out: { query: string; weak: boolean }[] = [{ query: base, weak: false }];
  const push = (s: string, weak: boolean) => {
    const v = s.replace(/^[\s,;:/-]+|[\s,;:/-]+$/g, "").trim();
    if (v.length >= 2 && !out.some((o) => o.query.toLowerCase() === v.toLowerCase()))
      out.push({ query: v, weak });
  };
  const paren = base.match(/^(.*?)\s*[([]\s*(.+?)\s*[)\]]\s*(.*)$/);
  if (paren) {
    push(`${paren[1]} ${paren[3]}`, false);
    push(paren[2], false);
  }
  push(base.replace(/[^\p{L}\p{N}\s,.-]/gu, " "), false);
  // US / common names whose EU INCI name differs.
  for (const v of [...out]) {
    const alias = EU_ALIASES[v.query.toLowerCase()];
    if (alias) push(alias, false);
  }
  // Lake pigments: "CI 15850:1" is listed in CosIng as "CI 15850".
  for (const m of Array.from(base.matchAll(/CI\s*(\d{5}):\d+/gi))) push(`CI ${m[1]}`, false);
  if (base.includes("/") && !/\d\/\d/.test(base)) base.split("/").forEach((p) => push(p, true));
  return out;
}

/**
 * Name search with fallbacks: if the full name finds nothing, retry with
 * the parts in parentheses / slashes. Returns the spelling that matched.
 */
export async function searchByName(
  name: string,
  signal?: AbortSignal
): Promise<SearchResult & { usedQuery: string; weak: boolean }> {
  let fallback: (SearchResult & { usedQuery: string; weak: boolean }) | null = null;
  for (const v of nameVariantsDetailed(name)) {
    const r = { ...(await searchByNameRaw(v.query, signal)), usedQuery: v.query, weak: v.weak };
    // An exact INCI match on any spelling wins (flagged when only a fragment matched).
    if (r.records.some((rec) => sameName(rec, v.query))) return r;
    // Otherwise remember the first spelling that found anything at all.
    if (!fallback || (fallback.total === 0 && r.total > 0)) fallback = r;
  }
  return fallback!;
}

/**
 * Search by CAS or EC number. CosIng's own form uses a wildcard so that
 * group entries ("69-72-7[1]/ 824-35-1[2]") are found; we then keep only
 * records that really list this number, so "50-00-0" never matches
 * "150-00-0".
 */
export async function searchByNumber(
  number: string,
  signal?: AbortSignal
): Promise<SearchResult> {
  const n = number.trim();
  const r = await post(
    {
      bool: {
        must: [
          { text: { query: `*${n}*`, fields: ["casNo", "ecNo"] } },
          ITEM_TYPES,
        ],
      },
    },
    signal
  );
  const records = r.records.filter(
    (rec) => rec.casNumbers.includes(n) || rec.ecNumbers.includes(n)
  );
  return { total: records.length, records };
}

/** Fetch records by CosIng id (used for annex details of an ingredient). */
export async function fetchByIds(
  ids: string[],
  signal?: AbortSignal
): Promise<CosingRecord[]> {
  if (!ids.length) return [];
  const r = await post({ bool: { must: [{ terms: { substanceId: ids } }] } }, signal);
  return r.records;
}

// ---------------------------------------------------------------- verdicts

export type Verdict =
  | "prohibited"
  | "restricted"
  | "listed"
  | "clear"
  | "review"
  | "notfound"
  | "error";

export const VERDICT_ORDER: Verdict[] = [
  "prohibited",
  "restricted",
  "listed",
  "review",
  "notfound",
  "error",
  "clear",
];

export const ANNEX_INFO: Record<string, { label: string; verdict: Verdict }> = {
  II: { label: "Annex II – Chất cấm", verdict: "prohibited" },
  III: { label: "Annex III – Chất bị hạn chế", verdict: "restricted" },
  IV: { label: "Annex IV – Chất tạo màu được phép", verdict: "listed" },
  V: { label: "Annex V – Chất bảo quản được phép", verdict: "listed" },
  VI: { label: "Annex VI – Chất lọc UV được phép", verdict: "listed" },
};

const norm = (s: string) =>
  s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function sameName(rec: CosingRecord, name: string): boolean {
  const n = norm(name);
  if (!n) return false;
  return [rec.inciName, rec.innName, rec.phEurName, rec.chemicalName].some(
    (x) => x && norm(x) === n
  );
}

/** Verdict from the annex references of the records that matched. */
export function verdictFor(records: CosingRecord[]): Verdict {
  const annexes = new Set(records.flatMap((r) => r.annexRefs.map((a) => a.annex)));
  if (annexes.has("II")) return "prohibited";
  if (annexes.has("III")) return "restricted";
  if (annexes.has("IV") || annexes.has("V") || annexes.has("VI")) return "listed";
  return "clear";
}

export const formatAnnexRefs = (refs: AnnexRef[]) =>
  refs.map((a) => (a.ref ? `${a.annex}/${a.ref}` : a.annex)).join(", ");
