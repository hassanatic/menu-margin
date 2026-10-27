-- Plain Postgres. Runs on a real server through DATABASE_URL, or in-process
-- through PGlite for local use and tests, so the same SQL is exercised in both.

CREATE TABLE IF NOT EXISTS ingredients (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  unit         TEXT NOT NULL CHECK (unit IN ('g', 'kg', 'ml', 'l', 'pcs')),
  price_cents  INTEGER NOT NULL CHECK (price_cents >= 0),
  waste_pct    NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (waste_pct >= 0 AND waste_pct < 100),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dishes (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  price_cents  INTEGER NOT NULL CHECK (price_cents >= 0),
  vat_pct      NUMERIC(5, 2) NOT NULL CHECK (vat_pct >= 0)
);

CREATE TABLE IF NOT EXISTS recipe_lines (
  dish_id        INTEGER NOT NULL REFERENCES dishes (id) ON DELETE CASCADE,
  ingredient_id  INTEGER NOT NULL REFERENCES ingredients (id) ON DELETE RESTRICT,
  qty            NUMERIC(12, 3) NOT NULL CHECK (qty > 0),
  unit           TEXT NOT NULL CHECK (unit IN ('g', 'kg', 'ml', 'l', 'pcs')),
  PRIMARY KEY (dish_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS haccp_checks (
  id                  SERIAL PRIMARY KEY,
  point               TEXT NOT NULL,
  kind                TEXT NOT NULL CHECK (kind IN ('fridge', 'freezer', 'hot_holding', 'cooling')),
  temp_c              NUMERIC(5, 1) NOT NULL,
  minutes_since_start INTEGER,
  ok                  BOOLEAN NOT NULL,
  reason              TEXT NOT NULL,
  corrective_action   TEXT,
  checked_by          TEXT NOT NULL,
  checked_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A failed check is only complete once someone wrote down what they did about it.
  CONSTRAINT failed_check_needs_action CHECK (ok OR corrective_action IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS haccp_checks_checked_at ON haccp_checks (checked_at DESC);
