/**
 * Payer contracts loaded from the spreadsheet the payer sends, and the terms a
 * flat rate list cannot express: the multiple-procedure payment reduction and
 * modifier percentages. Underpayment checks (server/fees.ts) apply both.
 */
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { schema } from "@/db";
import type { ContractRules } from "@/db/schema";
import { parseCsv } from "@/lib/import/csv";

const { feeSchedules, feeScheduleItems, auditLog } = schema;

const CODE_HEADERS = /^(cpt|hcpcs|cpt\/hcpcs|code|procedure|procedure code|proc code|service code)$/i;
const RATE_HEADERS = /^(allowed|allowable|allowed amount|rate|contract rate|fee|amount|price|reimbursement)$/i;
const MPPR_HEADERS = /^(mppr|multiple procedure|mult proc|multiple procedure indicator|mult proc ind)$/i;

/** "50=150, 80=16, AS=13.6" to { "50": 150, "80": 16, "AS": 13.6 }. */
export function parseModifierRules(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of text.split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean)) {
    const m = part.match(/^([A-Za-z0-9]{2})\s*[=:]\s*(\d+(?:\.\d+)?)\s*%?$/);
    if (!m) throw new Error(`"${part}" is not a modifier rule; write it like 50=150`);
    const pct = Number(m[2]);
    if (!(pct >= 0 && pct <= 300)) throw new Error(`Modifier ${m[1]}: the percentage must be between 0 and 300`);
    out[m[1].toUpperCase()] = pct;
  }
  return out;
}

export function formatModifierRules(mods: Record<string, number> | undefined) {
  return Object.entries(mods ?? {}).map(([m, p]) => `${m}=${p}`).join(", ");
}

/** Whether a spreadsheet cell marks the code as subject to the reduction (Y, yes, 1, true, or the MPFS indicator 2 or 3). */
const truthy = (v: string) => /^(y|yes|true|x|1|2|3)$/i.test(v.trim());

async function ownedSchedule(db: Db, practiceId: string, scheduleId: string) {
  const [s] = await db.select().from(feeSchedules).where(and(eq(feeSchedules.id, scheduleId), eq(feeSchedules.practiceId, practiceId))).limit(1);
  if (!s) throw new Error("Schedule not found");
  if (!s.payerId) throw new Error("Contract terms apply to payer contracts, not the standard charge schedule");
  return s;
}

export async function saveContractRules(db: Db, practiceId: string, scheduleId: string, input: { mpprPercent?: string | number | null; modifiers?: string }, userId?: string) {
  await ownedSchedule(db, practiceId, scheduleId);
  const rules: ContractRules = {};
  const raw = input.mpprPercent === undefined || input.mpprPercent === null ? "" : String(input.mpprPercent).trim();
  if (raw !== "") {
    const pct = Number(raw);
    if (!(pct >= 0 && pct <= 100)) throw new Error("The multiple-procedure percentage must be between 0 and 100");
    rules.mpprPercent = pct;
  }
  const mods = parseModifierRules(input.modifiers ?? "");
  if (Object.keys(mods).length) rules.modifiers = mods;
  await db.update(feeSchedules).set({ rules: Object.keys(rules).length ? rules : null }).where(eq(feeSchedules.id, scheduleId));
  await db.insert(auditLog).values({ practiceId, userId: userId ?? null, action: "contract_terms_saved", entity: "fee_schedule", entityId: scheduleId, details: rules });
  return rules;
}

/**
 * Loads a contract spreadsheet: a code column and an allowed-amount column
 * (named as payers usually name them), and optionally a column marking codes
 * subject to the multiple-procedure reduction. With `replace`, codes not in the
 * file are removed, so the schedule matches the contract exactly.
 */
export async function importContractCsv(db: Db, practiceId: string, scheduleId: string, text: string, opts: { replace?: boolean; userId?: string } = {}) {
  await ownedSchedule(db, practiceId, scheduleId);
  const table = parseCsv(text, 20_000);
  const find = (re: RegExp) => table.headers.findIndex((h) => re.test(h.trim()));
  const codeCol = find(CODE_HEADERS);
  const rateCol = find(RATE_HEADERS);
  const mpprCol = find(MPPR_HEADERS);
  if (codeCol < 0 || rateCol < 0) throw new Error(`The file needs a code column (CPT, HCPCS or Code) and an allowed amount column (Allowed, Rate or Fee). Found: ${table.headers.join(", ")}`);

  const items = new Map<string, { amountCents: number; mppr: boolean }>();
  const problems: string[] = [];
  table.rows.forEach((r, i) => {
    const code = (r[codeCol] ?? "").trim().toUpperCase();
    const amount = Number((r[rateCol] ?? "").replace(/[$,\s]/g, ""));
    if (!code && !(r[rateCol] ?? "").trim()) return;
    if (!/^[A-Z0-9]{5}$/.test(code)) { problems.push(`Row ${i + 2}: "${code}" is not a CPT or HCPCS code`); return; }
    if (!(amount > 0)) { problems.push(`Row ${i + 2}: ${code} has no allowed amount`); return; }
    items.set(code, { amountCents: Math.round(amount * 100), mppr: mpprCol >= 0 ? truthy(r[mpprCol] ?? "") : false });
  });
  if (!items.size) throw new Error(problems[0] ?? "No rates found in the file");

  if (opts.replace) await db.delete(feeScheduleItems).where(eq(feeScheduleItems.feeScheduleId, scheduleId));
  for (const [cpt, v] of items) {
    await db.insert(feeScheduleItems).values({ feeScheduleId: scheduleId, cpt, amountCents: v.amountCents, mppr: v.mppr })
      .onConflictDoUpdate({ target: [feeScheduleItems.feeScheduleId, feeScheduleItems.cpt], set: { amountCents: v.amountCents, mppr: v.mppr } });
  }
  await db.insert(auditLog).values({ practiceId, userId: opts.userId ?? null, action: "contract_imported", entity: "fee_schedule", entityId: scheduleId, details: { rates: items.size, problems: problems.length, replace: !!opts.replace } });
  return { imported: items.size, mppr: [...items.values()].filter((v) => v.mppr).length, problems };
}
