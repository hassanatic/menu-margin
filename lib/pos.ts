// POS exports differ between vendors, but most can produce a sales CSV with a
// date, an item name and a quantity. This parses that shape, matches items to
// dishes by a normalised name, and keeps the rows it could not match instead of
// dropping them, so the owner sees what is missing from the menu data.

export interface SaleRow {
  day: string; // YYYY-MM-DD
  item: string;
  qty: number;
}

export interface ParseResult {
  rows: SaleRow[];
  errors: { line: number; message: string }[];
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === "," || ch === ";") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseSalesCsv(text: string): ParseResult {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim() !== "");
  const result: ParseResult = { rows: [], errors: [] };
  if (lines.length === 0) return result;

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const col = (names: string[]) => header.findIndex((h) => names.includes(h));
  const dayIdx = col(["date", "day", "päivä"]);
  const itemIdx = col(["item", "product", "tuote", "name"]);
  const qtyIdx = col(["qty", "quantity", "määrä", "count"]);
  if (dayIdx < 0 || itemIdx < 0 || qtyIdx < 0) {
    result.errors.push({ line: 1, message: "header needs date, item and qty columns" });
    return result;
  }

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const day = cells[dayIdx] ?? "";
    const item = cells[itemIdx] ?? "";
    const qty = Number((cells[qtyIdx] ?? "").replace(",", "."));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      result.errors.push({ line: i + 1, message: `bad date "${day}"` });
      continue;
    }
    if (!item) {
      result.errors.push({ line: i + 1, message: "empty item" });
      continue;
    }
    if (!Number.isFinite(qty) || qty < 0) {
      result.errors.push({ line: i + 1, message: `bad quantity "${cells[qtyIdx]}"` });
      continue;
    }
    result.rows.push({ day, item, qty });
  }
  return result;
}

export function normaliseName(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

export interface DaySummary {
  day: string;
  revenueNetCents: number;
  theoreticalCostCents: number;
  foodCostPct: number;
  unmatched: { item: string; qty: number }[];
}

export function summariseDay(
  day: string,
  rows: SaleRow[],
  dishes: { name: string; costCents: number; netPriceCents: number }[],
): DaySummary {
  const byName = new Map(dishes.map((d) => [normaliseName(d.name), d]));
  let revenue = 0;
  let cost = 0;
  const unmatched = new Map<string, number>();
  for (const row of rows) {
    if (row.day !== day) continue;
    const dish = byName.get(normaliseName(row.item));
    if (!dish) {
      unmatched.set(row.item, (unmatched.get(row.item) ?? 0) + row.qty);
      continue;
    }
    revenue += dish.netPriceCents * row.qty;
    cost += dish.costCents * row.qty;
  }
  return {
    day,
    revenueNetCents: revenue,
    theoreticalCostCents: cost,
    foodCostPct: revenue === 0 ? 0 : Math.round((cost / revenue) * 1000) / 10,
    unmatched: [...unmatched].map(([item, qty]) => ({ item, qty })),
  };
}
