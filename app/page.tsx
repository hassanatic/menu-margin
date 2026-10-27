import { getDb } from "@/lib/db";
import { menuCosting } from "@/lib/repo";

export const dynamic = "force-dynamic";

// Above this share of the net price a dish is flagged for review. 30 % is a
// common rule of thumb for food cost; each restaurant sets its own target.
const TARGET_FOOD_COST_PCT = 30;

const eur = (cents: number) => (cents / 100).toLocaleString("fi-FI", { style: "currency", currency: "EUR" });

export default async function MenuPage() {
  const dishes = await menuCosting(await getDb());
  return (
    <>
      <h1>Menu costing</h1>
      <p>
        Cost per portion from current ingredient prices and waste, against the menu price without VAT. Dishes above{" "}
        {TARGET_FOOD_COST_PCT} % food cost are marked.
      </p>
      {dishes.length === 0 ? (
        <p>No dishes yet. Run <code>npm run seed</code> for example data.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Dish</th>
              <th className="num">Cost</th>
              <th className="num">Net price</th>
              <th className="num">Food cost</th>
              <th className="num">Margin</th>
            </tr>
          </thead>
          <tbody>
            {dishes.map((d) => (
              <tr key={d.dishId}>
                <td>{d.name}</td>
                <td className="num">{eur(d.costCents)}</td>
                <td className="num">{eur(d.netPriceCents)}</td>
                <td className={`num ${d.foodCostPct > TARGET_FOOD_COST_PCT ? "warn" : ""}`}>{d.foodCostPct} %</td>
                <td className="num">{eur(d.marginCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
