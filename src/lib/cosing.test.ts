import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import {
  isValidCas,
  nameVariants,
  parseAnnexRefs,
  searchByNumber,
  splitRegistryNumbers,
  verdictFor,
  CosingRecord,
} from "./cosing";
import { checkIngredient, makeRow, parsePastedList } from "./batch";
import { detectMapping, extractIngredients, Cell } from "./excel";

const rec = (over: Partial<CosingRecord>): CosingRecord => ({
  id: "1",
  itemType: "ingredient",
  inciName: "X",
  chemicalName: "",
  innName: "",
  phEurName: "",
  casNumbers: [],
  ecNumbers: [],
  casRaw: "",
  ecRaw: "",
  functions: [],
  annexRefs: [],
  linkedIds: [],
  maximumConcentration: "",
  conditions: "",
  productTypeBodyParts: "",
  otherRestrictions: [],
  sccsOpinions: [],
  status: "",
  description: "",
  ...over,
});

/** Fake CosIng API answer from a list of metadata objects. */
function mockFetch(handler: (query: any) => Record<string, unknown>[]) {
  (global as any).fetch = jest.fn(async (_url: string, init: any) => {
    const blob: Blob = init.body.get("query");
    const text = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsText(blob);
    });
    const metas = handler(JSON.parse(text));
    return {
      ok: true,
      status: 200,
      json: async () => ({ totalResults: metas.length, results: metas.map((metadata) => ({ metadata })) }),
    };
  });
}

describe("registry numbers", () => {
  it("validates the CAS check digit", () => {
    expect(isValidCas("69-72-7")).toBe(true);
    expect(isValidCas("7732-18-5")).toBe(true);
    expect(isValidCas("69-72-8")).toBe(false);
    expect(isValidCas("INCI Monograph ID : 6831")).toBe(false);
  });

  it("splits group entries", () => {
    expect(splitRegistryNumbers("69-72-7[1]/ 824-35-1[2]/ 18917-89-0[3]")).toEqual([
      "69-72-7",
      "824-35-1",
      "18917-89-0",
    ]);
    expect(splitRegistryNumbers("INCI Monograph ID : 6831")).toEqual([]);
  });
});

describe("annex", () => {
  it("parses restriction text", () => {
    expect(parseAnnexRefs("III/98\r\nV/3")).toEqual([
      { annex: "III", ref: "98" },
      { annex: "V", ref: "3" },
    ]);
  });

  it("takes the strictest annex", () => {
    expect(verdictFor([rec({ annexRefs: [{ annex: "V", ref: "3" }, { annex: "III", ref: "98" }] })])).toBe("restricted");
    expect(verdictFor([rec({ annexRefs: [{ annex: "II", ref: "1" }] })])).toBe("prohibited");
    expect(verdictFor([rec({ annexRefs: [{ annex: "IV", ref: "143" }] })])).toBe("listed");
    expect(verdictFor([rec({})])).toBe("clear");
  });
});

describe("name variants", () => {
  it("tries the parts of composite names", () => {
    expect(nameVariants("Titanium Dioxide (CI 77891)")).toEqual(
      expect.arrayContaining(["Titanium Dioxide (CI 77891)", "Titanium Dioxide", "CI 77891"])
    );
    expect(nameVariants("Fragrance(Parfum)")).toEqual(expect.arrayContaining(["Fragrance", "Parfum"]));
    expect(nameVariants("Aqua/Water")).toEqual(expect.arrayContaining(["Aqua", "Water"]));
    expect(nameVariants("Fragrance")).toContain("Parfum");
    expect(nameVariants("Red 7 Lake (CI 15850:1)")).toContain("CI 15850");
  });
});

describe("slash fragments", () => {
  it("never treats a slash fragment hit as an exact match", async () => {
    mockFetch((q) => {
      const text = JSON.stringify(q);
      return text.includes('"query":"Lactobacillus"')
        ? [{ substanceId: ["9"], inciName: ["LACTOBACILLUS"], itemType: ["ingredient"] }]
        : [];
    });
    const row = makeRow({ source: 1, name: "Lactobacillus/Rye Flour Ferment", cas: "" }, 0);
    const done = await checkIngredient(row, "auto");
    expect(done.verdict).toBe("review");
    expect(done.matches).toHaveLength(0);
    expect(done.candidates.map((c) => c.inciName)).toEqual(["LACTOBACILLUS"]);
  });
});

describe("pasted lists", () => {
  it("splits a packaging INCI list but keeps 1,2-Hexanediol whole", () => {
    const items = parsePastedList("Aqua, Glycerin, 1,2-Hexanediol, Salicylic Acid");
    expect(items.map((i) => i.name)).toEqual(["Aqua", "Glycerin", "1,2-Hexanediol", "Salicylic Acid"]);
  });

  it("reads name + CAS + % per line", () => {
    const items = parsePastedList("Glycerin\t56-81-5\t5\nNiacinamide, 98-92-0\n69-72-7");
    expect(items).toEqual([
      expect.objectContaining({ name: "Glycerin", cas: "56-81-5", percentage: 5 }),
      expect.objectContaining({ name: "Niacinamide", cas: "98-92-0" }),
      expect.objectContaining({ name: "", cas: "69-72-7" }),
    ]);
  });
});

describe("excel detection", () => {
  it("finds the ingredient table in the sample formula sheet", () => {
    const buf = fs.readFileSync(path.join(__dirname, "../../public/example.xlsx"));
    const wb = XLSX.read(buf, { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: true, defval: null });
    const m = detectMapping(rows);
    expect(m).toMatchObject({ nameCol: 0, pctCol: 1, casCol: 2, fnCol: 4, startRow: 10 });
    const items = extractIngredients(rows, m);
    expect(items[0]).toMatchObject({ name: "Water", cas: "7732-18-5" });
    expect(items[items.length - 1].name).toBe("Riboflavin");
    expect(items).toHaveLength(47);
  });
});

describe("CosIng search", () => {
  it("drops CAS hits that only contain the number as a substring", async () => {
    mockFetch(() => [
      { substanceId: ["1"], inciName: ["FORMALDEHYDE"], casNo: ["50-00-0"], itemType: ["ingredient"] },
      { substanceId: ["2"], inciName: ["OTHER"], casNo: ["150-00-0"], itemType: ["ingredient"] },
    ]);
    const r = await searchByNumber("50-00-0");
    expect(r.records.map((x) => x.inciName)).toEqual(["FORMALDEHYDE"]);
  });

  it("classifies an ingredient matched by name and CAS", async () => {
    mockFetch((q) => {
      const isCas = JSON.stringify(q).includes("casNo");
      return [
        {
          substanceId: ["37595"],
          inciName: ["SALICYLIC ACID"],
          casNo: ["69-72-7"],
          cosmeticRestriction: ["III/98\r\nV/3"],
          itemType: ["ingredient"],
        },
        ...(isCas ? [] : [{ substanceId: ["32421"], inciName: ["CAPRYLOYL SALICYLIC ACID"], itemType: ["ingredient"] }]),
      ];
    });
    const row = makeRow({ source: 1, name: "Salicylic Acid", cas: "69-72-7" }, 0);
    const done = await checkIngredient(row, "auto");
    expect(done.verdict).toBe("restricted");
    expect(done.matchedBy).toEqual(["name", "cas"]);
    expect(done.matches.map((m) => m.inciName)).toEqual(["SALICYLIC ACID"]);
    expect(done.candidates.map((m) => m.inciName)).toEqual(["CAPRYLOYL SALICYLIC ACID"]);
  });
});
