import { convert, type Unit } from "./units";

// Money is kept in integer cents end to end. Ingredient prices can be finer
// than a cent per gram, so the price is stored per purchase unit (e.g. per kg)
// and only the final dish cost is rounded.

export interface Ingredient {
  id: number;
  name: string;
  unit: Unit; // purchase unit, e.g. "kg"
  priceCents: number; // price per purchase unit, VAT excluded
  wastePct: number; // trim and spoilage, 0-100
}

export interface RecipeLine {
  ingredientId: number;
  qty: number;
  unit: Unit;
}

export interface Dish {
  id: number;
  name: string;
  priceCents: number; // menu price, VAT included
  vatPct: number; // VAT rate on the menu price, set per country and dish type
}

export interface DishCosting {
  dishId: number;
  name: string;
  costCents: number;
  netPriceCents: number;
  foodCostPct: number;
  marginCents: number;
}

export function lineCostCents(line: RecipeLine, ingredient: Ingredient): number {
  const qtyInPurchaseUnit = convert(line.qty, line.unit, ingredient.unit);
  // Waste means you buy more than ends up on the plate.
  const yieldFactor = 1 - ingredient.wastePct / 100;
  if (yieldFactor <= 0) throw new Error(`ingredient ${ingredient.name} has no usable yield`);
  return (qtyInPurchaseUnit / yieldFactor) * ingredient.priceCents;
}

export function netPriceCents(dish: Dish): number {
  return Math.round(dish.priceCents / (1 + dish.vatPct / 100));
}

export function costDish(
  dish: Dish,
  lines: RecipeLine[],
  ingredients: Map<number, Ingredient>,
): DishCosting {
  let cost = 0;
  for (const line of lines) {
    const ingredient = ingredients.get(line.ingredientId);
    if (!ingredient) throw new Error(`dish ${dish.name} uses unknown ingredient ${line.ingredientId}`);
    cost += lineCostCents(line, ingredient);
  }
  const costCents = Math.round(cost);
  const net = netPriceCents(dish);
  return {
    dishId: dish.id,
    name: dish.name,
    costCents,
    netPriceCents: net,
    foodCostPct: net === 0 ? 0 : Math.round((costCents / net) * 1000) / 10,
    marginCents: net - costCents,
  };
}
