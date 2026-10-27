import { describe, expect, it } from "vitest";
import { convert } from "@/lib/units";
import { costDish, lineCostCents, netPriceCents, type Ingredient } from "@/lib/costing";
import { evaluate } from "@/lib/haccp";
import { normaliseName, parseSalesCsv, summariseDay } from "@/lib/pos";

describe("units", () => {
  it("converts within a dimension", () => {
    expect(convert(120, "g", "kg")).toBeCloseTo(0.12);
    expect(convert(1.5, "l", "ml")).toBe(1500);
  });
  it("refuses to convert across dimensions", () => {
    expect(() => convert(1, "kg", "l")).toThrow(/mass vs volume/);
  });
});

describe("costing", () => {
  const salmon: Ingredient = { id: 1, name: "salmon", unit: "kg", priceCents: 2400, wastePct: 20 };
  const potato: Ingredient = { id: 2, name: "potato", unit: "kg", priceCents: 120, wastePct: 0 };
  const cream: Ingredient = { id: 3, name: "cream", unit: "l", priceCents: 450, wastePct: 0 };
  const ingredients = new Map([salmon, potato, cream].map((i) => [i.id, i]));

  it("adds waste on top of the plated quantity", () => {
    // 150 g plated at 20 % waste means 187.5 g bought: 0.1875 kg * 2400 = 450 cents
    expect(lineCostCents({ ingredientId: 1, qty: 150, unit: "g" }, salmon)).toBeCloseTo(450);
  });

  it("removes VAT from the menu price before the margin", () => {
    expect(netPriceCents({ id: 1, name: "x", priceCents: 2280, vatPct: 14 })).toBe(2000);
  });

  it("costs a dish and reports food cost percent and margin", () => {
    const c = costDish(
      { id: 1, name: "Salmon soup", priceCents: 2280, vatPct: 14 },
      [
        { ingredientId: 1, qty: 150, unit: "g" },
        { ingredientId: 2, qty: 200, unit: "g" },
        { ingredientId: 3, qty: 100, unit: "ml" },
      ],
      ingredients,
    );
    // 450 + 24 + 45 = 519 cents against a 2000 cent net price
    expect(c.costCents).toBe(519);
    expect(c.foodCostPct).toBe(26);
    expect(c.marginCents).toBe(1481);
  });

  it("fails loudly on a recipe line that points at nothing", () => {
    expect(() =>
      costDish({ id: 2, name: "Ghost", priceCents: 1000, vatPct: 14 }, [{ ingredientId: 99, qty: 1, unit: "pcs" }], ingredients),
    ).toThrow(/unknown ingredient/);
  });
});

describe("haccp", () => {
  it("flags a warm fridge and a cold bain-marie", () => {
    expect(evaluate({ point: "walk-in", kind: "fridge", tempC: 4 }).ok).toBe(true);
    expect(evaluate({ point: "walk-in", kind: "fridge", tempC: 8 }).ok).toBe(false);
    expect(evaluate({ point: "soup", kind: "hot_holding", tempC: 55 }).ok).toBe(false);
    expect(evaluate({ point: "freezer", kind: "freezer", tempC: -20 }).ok).toBe(true);
  });

  it("judges cooling by both temperature and elapsed time", () => {
    expect(evaluate({ point: "stock", kind: "cooling", tempC: 5, minutesSinceStart: 180 }).ok).toBe(true);
    expect(evaluate({ point: "stock", kind: "cooling", tempC: 5, minutesSinceStart: 300 }).ok).toBe(false);
    expect(evaluate({ point: "stock", kind: "cooling", tempC: 20, minutesSinceStart: 90 }).ok).toBe(true);
    expect(evaluate({ point: "stock", kind: "cooling", tempC: 20, minutesSinceStart: 260 }).ok).toBe(false);
    expect(evaluate({ point: "stock", kind: "cooling", tempC: 20 }).ok).toBe(false);
  });

  it("accepts a kitchen's own limits", () => {
    expect(evaluate({ point: "walk-in", kind: "fridge", tempC: 5 }, { ...defaultsWith({ fridgeMaxC: 4 }) }).ok).toBe(false);
  });
});

function defaultsWith(over: Partial<import("@/lib/haccp").Limits>) {
  return { fridgeMaxC: 6, freezerMaxC: -18, hotHoldingMinC: 60, coolingTargetC: 6, coolingMaxMinutes: 240, ...over };
}

describe("pos import", () => {
  it("parses a semicolon export with Finnish headers and decimal commas", () => {
    const r = parseSalesCsv("Päivä;Tuote;Määrä\n2026-10-27;Lohikeitto;12\n2026-10-27;Kahvi;3,0\n");
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      { day: "2026-10-27", item: "Lohikeitto", qty: 12 },
      { day: "2026-10-27", item: "Kahvi", qty: 3 },
    ]);
  });

  it("keeps quoted commas and reports bad rows instead of dropping them silently", () => {
    const r = parseSalesCsv('date,item,qty\n2026-10-27,"Burger, double",2\n27.10.2026,Fries,1\n2026-10-27,Fries,-1\n');
    expect(r.rows).toEqual([{ day: "2026-10-27", item: "Burger, double", qty: 2 }]);
    expect(r.errors.map((e) => e.line)).toEqual([3, 4]);
  });

  it("matches names regardless of case and accents", () => {
    expect(normaliseName("Crème Brûlée")).toBe(normaliseName("creme brulee"));
  });

  it("summarises a day and lists items with no recipe", () => {
    const s = summariseDay(
      "2026-10-27",
      [
        { day: "2026-10-27", item: "salmon soup", qty: 10 },
        { day: "2026-10-27", item: "Daily special", qty: 4 },
        { day: "2026-10-26", item: "Salmon soup", qty: 99 },
      ],
      [{ name: "Salmon soup", costCents: 519, netPriceCents: 2000 }],
    );
    expect(s.revenueNetCents).toBe(20000);
    expect(s.theoreticalCostCents).toBe(5190);
    expect(s.foodCostPct).toBe(26);
    expect(s.unmatched).toEqual([{ item: "Daily special", qty: 4 }]);
  });
});
