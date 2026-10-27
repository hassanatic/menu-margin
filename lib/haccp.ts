// Temperature checks for a self-monitoring plan. The limits below are example
// defaults for a small kitchen; every kitchen sets its own in its plan, and the
// local food authority has the final word. They live in one table so a
// restaurant can change them without touching the evaluation logic.

export type CheckKind = "fridge" | "freezer" | "hot_holding" | "cooling";

export interface Limits {
  fridgeMaxC: number;
  freezerMaxC: number;
  hotHoldingMinC: number;
  coolingTargetC: number;
  coolingMaxMinutes: number;
}

export const DEFAULT_LIMITS: Limits = {
  fridgeMaxC: 6,
  freezerMaxC: -18,
  hotHoldingMinC: 60,
  coolingTargetC: 6,
  coolingMaxMinutes: 240,
};

export interface Check {
  point: string; // "walk-in fridge", "soup bain-marie"
  kind: CheckKind;
  tempC: number;
  minutesSinceStart?: number; // only for cooling checks
}

export interface Verdict {
  ok: boolean;
  reason: string;
}

export function evaluate(check: Check, limits: Limits = DEFAULT_LIMITS): Verdict {
  switch (check.kind) {
    case "fridge":
      return check.tempC <= limits.fridgeMaxC
        ? { ok: true, reason: "within limit" }
        : { ok: false, reason: `${check.tempC} °C is above the fridge limit of ${limits.fridgeMaxC} °C` };
    case "freezer":
      return check.tempC <= limits.freezerMaxC
        ? { ok: true, reason: "within limit" }
        : { ok: false, reason: `${check.tempC} °C is above the freezer limit of ${limits.freezerMaxC} °C` };
    case "hot_holding":
      return check.tempC >= limits.hotHoldingMinC
        ? { ok: true, reason: "within limit" }
        : { ok: false, reason: `${check.tempC} °C is below the hot holding minimum of ${limits.hotHoldingMinC} °C` };
    case "cooling": {
      if (check.minutesSinceStart === undefined) {
        return { ok: false, reason: "cooling check needs the minutes since cooling started" };
      }
      if (check.tempC <= limits.coolingTargetC) {
        return check.minutesSinceStart <= limits.coolingMaxMinutes
          ? { ok: true, reason: `cooled to ${check.tempC} °C in ${check.minutesSinceStart} min` }
          : { ok: false, reason: `reached ${limits.coolingTargetC} °C but took ${check.minutesSinceStart} min` };
      }
      return check.minutesSinceStart <= limits.coolingMaxMinutes
        ? { ok: true, reason: "still cooling, inside the time window" }
        : { ok: false, reason: `still ${check.tempC} °C after ${check.minutesSinceStart} min` };
    }
  }
}
