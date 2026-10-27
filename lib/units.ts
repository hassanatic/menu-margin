// Quantities in recipes and on supplier invoices rarely use the same unit:
// a recipe says 120 g, the invoice prices the kilo. Everything is converted
// to a base unit per dimension before any money is multiplied.

export type Unit = "g" | "kg" | "ml" | "l" | "pcs";

type Dimension = "mass" | "volume" | "count";

const TABLE: Record<Unit, { dimension: Dimension; toBase: number }> = {
  g: { dimension: "mass", toBase: 1 },
  kg: { dimension: "mass", toBase: 1000 },
  ml: { dimension: "volume", toBase: 1 },
  l: { dimension: "volume", toBase: 1000 },
  pcs: { dimension: "count", toBase: 1 },
};

export function isUnit(value: string): value is Unit {
  return Object.prototype.hasOwnProperty.call(TABLE, value);
}

export function convert(qty: number, from: Unit, to: Unit): number {
  const a = TABLE[from];
  const b = TABLE[to];
  if (a.dimension !== b.dimension) {
    throw new Error(`cannot convert ${from} to ${to}: ${a.dimension} vs ${b.dimension}`);
  }
  return (qty * a.toBase) / b.toBase;
}
