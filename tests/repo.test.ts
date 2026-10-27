import { beforeEach, describe, expect, it } from "vitest";
import { openPglite, type Db } from "@/lib/db";
import { createDish, logCheck, menuCosting, recentChecks, upsertIngredient } from "@/lib/repo";

// These run the real schema on an in-memory Postgres (PGlite), so constraints,
// NUMERIC handling and transactions are tested, not mocked.

let db: Db;

beforeEach(async () => {
  db = await openPglite();
});

describe("menu costing from the database", () => {
  it("costs every dish from stored ingredients and recipes", async () => {
    const salmon = await upsertIngredient(db, { name: "salmon", unit: "kg", priceCents: 2400, wastePct: 20 });
    const potato = await upsertIngredient(db, { name: "potato", unit: "kg", priceCents: 120, wastePct: 0 });
    await createDish(db, { name: "Salmon soup", priceCents: 2280, vatPct: 14 }, [
      { ingredientId: salmon, qty: 150, unit: "g" },
      { ingredientId: potato, qty: 200, unit: "g" },
    ]);
    const [soup] = await menuCosting(db);
    expect(soup.costCents).toBe(474);
    expect(soup.netPriceCents).toBe(2000);
    expect(soup.foodCostPct).toBe(23.7);
  });

  it("re-prices dishes when a supplier price changes", async () => {
    const id = await upsertIngredient(db, { name: "butter", unit: "kg", priceCents: 800, wastePct: 0 });
    await createDish(db, { name: "Toast", priceCents: 570, vatPct: 14 }, [{ ingredientId: id, qty: 50, unit: "g" }]);
    expect((await menuCosting(db))[0].costCents).toBe(40);
    await upsertIngredient(db, { name: "butter", unit: "kg", priceCents: 1200, wastePct: 0 });
    expect((await menuCosting(db))[0].costCents).toBe(60);
  });

  it("rolls back a dish whose recipe references a missing ingredient", async () => {
    await expect(
      createDish(db, { name: "Broken", priceCents: 1000, vatPct: 14 }, [{ ingredientId: 999, qty: 1, unit: "pcs" }]),
    ).rejects.toThrow();
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM dishes`);
    expect(rows[0]).toEqual({ n: 0 });
  });
});

describe("haccp log", () => {
  it("stores a passing check", async () => {
    const r = await logCheck(db, { point: "walk-in", kind: "fridge", tempC: 3.5 }, "Aino");
    expect(r.ok).toBe(true);
    const [row] = await recentChecks(db);
    expect(row.tempC).toBe(3.5);
    expect(row.checked_by).toBe("Aino");
  });

  it("refuses a failed check without a corrective action", async () => {
    await expect(logCheck(db, { point: "walk-in", kind: "fridge", tempC: 9 }, "Aino")).rejects.toThrow(/corrective action/);
    expect(await recentChecks(db)).toEqual([]);
  });

  it("stores a failed check together with what was done about it", async () => {
    const r = await logCheck(db, { point: "soup", kind: "hot_holding", tempC: 52 }, "Mikko", "reheated to 75 °C");
    expect(r.ok).toBe(false);
    const [row] = await recentChecks(db);
    expect(row.corrective_action).toBe("reheated to 75 °C");
  });

  it("is also enforced by the database, not only the app", async () => {
    await expect(
      db.query(
        `INSERT INTO haccp_checks (point, kind, temp_c, ok, reason, checked_by) VALUES ('x', 'fridge', 9, false, 'warm', 'y')`,
      ),
    ).rejects.toThrow(/failed_check_needs_action/);
  });
});
