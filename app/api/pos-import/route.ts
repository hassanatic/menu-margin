import { getDb } from "@/lib/db";
import { menuCosting } from "@/lib/repo";
import { parseSalesCsv, summariseDay } from "@/lib/pos";

// POST a POS sales export as text/csv and get back, per day, the net revenue,
// the theoretical food cost of what was sold, and the items that have no
// recipe yet. Bad rows are reported with their line numbers.
export async function POST(request: Request): Promise<Response> {
  const text = await request.text();
  if (text.length > 2_000_000) {
    return Response.json({ error: "file too large" }, { status: 413 });
  }
  const parsed = parseSalesCsv(text);
  if (parsed.rows.length === 0) {
    return Response.json({ error: "no valid rows", errors: parsed.errors }, { status: 400 });
  }
  const dishes = await menuCosting(await getDb());
  const days = [...new Set(parsed.rows.map((r) => r.day))].sort();
  return Response.json({
    days: days.map((day) => summariseDay(day, parsed.rows, dishes)),
    errors: parsed.errors,
  });
}
