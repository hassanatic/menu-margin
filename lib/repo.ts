import type { Db } from "./db";
import { costDish, type DishCosting, type Ingredient, type RecipeLine } from "./costing";
import { evaluate, type Check, type Verdict } from "./haccp";
import type { Unit } from "./units";

// NUMERIC columns come back as strings from Postgres, so every read converts
// explicitly instead of trusting the driver.

export async function upsertIngredient(db: Db, i: Omit<Ingredient, "id">): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO ingredients (name, unit, price_cents, waste_pct)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (name) DO UPDATE
       SET unit = EXCLUDED.unit, price_cents = EXCLUDED.price_cents,
           waste_pct = EXCLUDED.waste_pct, updated_at = now()
     RETURNING id`,
    [i.name, i.unit, i.priceCents, i.wastePct],
  );
  return rows[0].id;
}

export async function createDish(
  db: Db,
  dish: { name: string; priceCents: number; vatPct: number },
  lines: RecipeLine[],
): Promise<number> {
  await db.exec("BEGIN");
  try {
    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO dishes (name, price_cents, vat_pct) VALUES ($1, $2, $3) RETURNING id`,
      [dish.name, dish.priceCents, dish.vatPct],
    );
    const id = rows[0].id;
    for (const l of lines) {
      await db.query(
        `INSERT INTO recipe_lines (dish_id, ingredient_id, qty, unit) VALUES ($1, $2, $3, $4)`,
        [id, l.ingredientId, l.qty, l.unit],
      );
    }
    await db.exec("COMMIT");
    return id;
  } catch (err) {
    await db.exec("ROLLBACK");
    throw err;
  }
}

export async function menuCosting(db: Db): Promise<DishCosting[]> {
  const ing = await db.query<{ id: number; name: string; unit: Unit; price_cents: number; waste_pct: string }>(
    `SELECT id, name, unit, price_cents, waste_pct FROM ingredients`,
  );
  const ingredients = new Map<number, Ingredient>(
    ing.rows.map((r) => [
      r.id,
      { id: r.id, name: r.name, unit: r.unit, priceCents: r.price_cents, wastePct: Number(r.waste_pct) },
    ]),
  );
  const dishes = await db.query<{ id: number; name: string; price_cents: number; vat_pct: string }>(
    `SELECT id, name, price_cents, vat_pct FROM dishes ORDER BY name`,
  );
  const lines = await db.query<{ dish_id: number; ingredient_id: number; qty: string; unit: Unit }>(
    `SELECT dish_id, ingredient_id, qty, unit FROM recipe_lines`,
  );
  const byDish = new Map<number, RecipeLine[]>();
  for (const l of lines.rows) {
    const list = byDish.get(l.dish_id) ?? [];
    list.push({ ingredientId: l.ingredient_id, qty: Number(l.qty), unit: l.unit });
    byDish.set(l.dish_id, list);
  }
  return dishes.rows.map((d) =>
    costDish(
      { id: d.id, name: d.name, priceCents: d.price_cents, vatPct: Number(d.vat_pct) },
      byDish.get(d.id) ?? [],
      ingredients,
    ),
  );
}

export interface LoggedCheck extends Verdict {
  id: number;
}

export async function logCheck(
  db: Db,
  check: Check,
  checkedBy: string,
  correctiveAction?: string,
): Promise<LoggedCheck> {
  const verdict = evaluate(check);
  if (!verdict.ok && !correctiveAction?.trim()) {
    throw new Error(`failed check needs a corrective action: ${verdict.reason}`);
  }
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO haccp_checks (point, kind, temp_c, minutes_since_start, ok, reason, corrective_action, checked_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      check.point,
      check.kind,
      check.tempC,
      check.minutesSinceStart ?? null,
      verdict.ok,
      verdict.reason,
      correctiveAction?.trim() || null,
      checkedBy,
    ],
  );
  return { id: rows[0].id, ...verdict };
}

export async function recentChecks(db: Db, limit = 20) {
  const { rows } = await db.query<{
    id: number;
    point: string;
    kind: string;
    temp_c: string;
    ok: boolean;
    reason: string;
    corrective_action: string | null;
    checked_by: string;
    checked_at: Date | string;
  }>(
    `SELECT id, point, kind, temp_c, ok, reason, corrective_action, checked_by, checked_at
     FROM haccp_checks ORDER BY checked_at DESC, id DESC LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({ ...r, tempC: Number(r.temp_c), checkedAt: new Date(r.checked_at).toISOString() }));
}
