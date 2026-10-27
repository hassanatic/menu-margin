import path from "node:path";
import { openPglite, openPostgres } from "../lib/db";
import { createDish, upsertIngredient } from "../lib/repo";

// Example data for a small lunch restaurant. Prices are illustrative.
async function main() {
  const db = process.env.DATABASE_URL
    ? await openPostgres(process.env.DATABASE_URL)
    : await openPglite(path.join(process.cwd(), "data", "pglite"));

  const id = async (name: string, unit: "kg" | "l" | "pcs", priceCents: number, wastePct = 0) =>
    upsertIngredient(db, { name, unit, priceCents, wastePct });

  const salmon = await id("salmon fillet", "kg", 2400, 20);
  const potato = await id("potato", "kg", 120, 15);
  const cream = await id("cream", "l", 450);
  const leek = await id("leek", "kg", 380, 30);
  const bread = await id("rye bread", "kg", 600);
  const minced = await id("minced beef", "kg", 1150);
  const lingonberry = await id("lingonberry jam", "kg", 900);

  const existing = await db.query(`SELECT count(*)::int AS n FROM dishes`);
  if ((existing.rows[0] as { n: number }).n > 0) {
    console.log("dishes already exist, ingredient prices refreshed");
    return;
  }

  await createDish(db, { name: "Salmon soup", priceCents: 1590, vatPct: 14 }, [
    { ingredientId: salmon, qty: 120, unit: "g" },
    { ingredientId: potato, qty: 180, unit: "g" },
    { ingredientId: cream, qty: 80, unit: "ml" },
    { ingredientId: leek, qty: 40, unit: "g" },
    { ingredientId: bread, qty: 60, unit: "g" },
  ]);
  await createDish(db, { name: "Meatballs with mash", priceCents: 1450, vatPct: 14 }, [
    { ingredientId: minced, qty: 180, unit: "g" },
    { ingredientId: potato, qty: 250, unit: "g" },
    { ingredientId: cream, qty: 50, unit: "ml" },
    { ingredientId: lingonberry, qty: 30, unit: "g" },
  ]);
  console.log("seeded 2 dishes");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
