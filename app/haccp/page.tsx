import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { logCheck, recentChecks } from "@/lib/repo";
import type { CheckKind } from "@/lib/haccp";

export const dynamic = "force-dynamic";

const KINDS: CheckKind[] = ["fridge", "freezer", "hot_holding", "cooling"];

async function addCheck(formData: FormData): Promise<void> {
  "use server";
  const kind = String(formData.get("kind")) as CheckKind;
  if (!KINDS.includes(kind)) throw new Error("unknown check kind");
  const minutes = String(formData.get("minutes") ?? "").trim();
  await logCheck(
    await getDb(),
    {
      point: String(formData.get("point") ?? "").trim() || "unnamed point",
      kind,
      tempC: Number(String(formData.get("temp")).replace(",", ".")),
      minutesSinceStart: minutes ? Number(minutes) : undefined,
    },
    String(formData.get("by") ?? "").trim() || "unknown",
    String(formData.get("action") ?? ""),
  );
  revalidatePath("/haccp");
}

export default async function HaccpPage() {
  const checks = await recentChecks(await getDb());
  return (
    <>
      <h1>HACCP temperature log</h1>
      <form action={addCheck}>
        <input name="point" placeholder="Check point, e.g. walk-in fridge" required />
        <select name="kind" defaultValue="fridge">
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k.replace("_", " ")}
            </option>
          ))}
        </select>
        <input name="temp" placeholder="Temperature °C" inputMode="decimal" required />
        <input name="minutes" placeholder="Minutes since cooling started (cooling only)" inputMode="numeric" />
        <input name="action" placeholder="Corrective action (required if the check fails)" />
        <input name="by" placeholder="Checked by" required />
        <button type="submit">Log check</button>
      </form>
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Point</th>
            <th className="num">°C</th>
            <th>Result</th>
            <th>Action</th>
            <th>By</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => (
            <tr key={c.id}>
              <td>{new Date(c.checkedAt).toLocaleString("fi-FI")}</td>
              <td>{c.point}</td>
              <td className="num">{c.tempC}</td>
              <td className={c.ok ? "" : "warn"}>{c.ok ? "OK" : c.reason}</td>
              <td>{c.corrective_action ?? ""}</td>
              <td>{c.checked_by}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
