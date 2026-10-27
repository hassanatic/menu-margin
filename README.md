# menu-margin

Food cost, menu margins, HACCP temperature checks and POS sales import for a small restaurant.
Next.js (App Router), TypeScript and Postgres.

A restaurant owner usually knows the menu price of a dish but not what it costs to make once trim
and spoilage are counted, or how that changes when a supplier raises the price of salmon. This app
keeps ingredient prices and recipes in Postgres and shows, per dish, the cost per portion, the food
cost as a share of the price without VAT, and the margin. A POS sales export turns that into the
theoretical food cost of a whole day, and lists sold items that have no recipe yet.

The HACCP page is a temperature log for a self-monitoring plan: fridges, freezers, hot holding and
cooling. A failed check cannot be saved without a corrective action, and that rule is enforced by a
CHECK constraint in the database as well as in the app.

## What is in it

- `lib/units.ts`: unit conversion (g/kg, ml/l, pcs). Converting across dimensions is an error.
- `lib/costing.ts`: cost per dish in integer cents, with waste percentage and VAT removed from the
  menu price before the margin is calculated.
- `lib/haccp.ts`: check evaluation with limits kept in one table. The defaults are examples; each
  kitchen sets its own limits in its plan.
- `lib/pos.ts`: CSV parsing for POS exports (comma or semicolon, quoted fields, decimal commas,
  English or Finnish headers), name matching that ignores case and accents, and a daily summary.
  Bad rows are reported with their line number instead of being dropped.
- `lib/db.ts`, `db/schema.sql`, `lib/repo.ts`: plain SQL. With `DATABASE_URL` set it uses
  node-postgres; without it, PGlite runs Postgres in-process, so local runs and tests use the same
  SQL and constraints.
- `app/`: the menu costing page, the HACCP log (server action) and `POST /api/pos-import`.

## Run it

```bash
npm install
npm run seed      # example ingredients and two dishes
npm run dev       # http://localhost:3000
```

Use a real Postgres instead of PGlite:

```bash
DATABASE_URL=postgres://user:pass@localhost:5432/menu npm run seed
DATABASE_URL=postgres://user:pass@localhost:5432/menu npm run dev
```

Import a day of sales:

```bash
curl -X POST --data-binary @sales.csv -H 'content-type: text/csv' http://localhost:3000/api/pos-import
```

## Tests

```bash
npm test
```

20 tests: the costing, HACCP and CSV logic, and repository tests that run the real schema on an
in-memory Postgres (PGlite), including the transaction rollback when a recipe points at a missing
ingredient and the database constraint on failed checks. CI runs typecheck, tests and `next build`.

## Not in it

No authentication, no multi-restaurant tenancy, no stock levels or purchase orders, and no live POS
connection: sales come in as a CSV export. Example prices and HACCP limits are illustrative.
