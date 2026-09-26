/**
 * Clearinghouse enrollment: before a payer sends ERAs (835s) or direct deposits
 * (EFT) for the practice, or accepts its claims electronically in some cases,
 * the practice has to enroll with that payer for each transaction. It is
 * paperwork done in the clearinghouse's and payer's portals; this tracks where
 * each one stands so a missing ERA is explained instead of wondered about.
 *
 * Tracking only: enrollments are not submitted to Stedi from here.
 */
import { and, asc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { schema } from "@/db";
import { assertOwned } from "./tenancy";

const { transactionEnrollments, payers, claims, auditLog } = schema;

export const TRANSACTIONS = [
  { key: "claims", label: "Claims (837)" },
  { key: "era", label: "Remittances (835)" },
  { key: "eft", label: "Direct deposit (EFT)" },
  { key: "eligibility", label: "Eligibility (270/271)" },
  { key: "claim_status", label: "Claim status (276/277)" },
] as const;
export type TransactionKey = (typeof TRANSACTIONS)[number]["key"];
export const TXN_STATUSES = ["not_started", "not_required", "submitted", "approved", "rejected"] as const;
export type TxnStatus = (typeof TXN_STATUSES)[number];

export async function transactionGrid(db: Db, practiceId: string) {
  const [pays, rows] = await Promise.all([
    db.select().from(payers).where(and(eq(payers.practiceId, practiceId), ne(payers.type, "self_pay"))).orderBy(asc(payers.name)),
    db.select().from(transactionEnrollments).where(eq(transactionEnrollments.practiceId, practiceId)),
  ]);
  const byKey = new Map(rows.map((r) => [`${r.payerId}|${r.transaction}`, r]));
  return { payers: pays, get: (payerId: string, t: string) => byKey.get(`${payerId}|${t}`) ?? null };
}

/** Saves one payer's row; each changed status stamps its submitted or approved date. */
export async function saveTransactionEnrollments(db: Db, practiceId: string, payerId: string, statuses: Partial<Record<TransactionKey, string>>, userId?: string, today = new Date().toISOString().slice(0, 10)) {
  await assertOwned(db, practiceId, "payer", payerId);
  const changed: string[] = [];
  for (const { key } of TRANSACTIONS) {
    const status = statuses[key];
    if (!status) continue;
    if (!TXN_STATUSES.includes(status as TxnStatus)) throw new Error("Unknown status");
    const [prev] = await db.select().from(transactionEnrollments).where(and(eq(transactionEnrollments.practiceId, practiceId), eq(transactionEnrollments.payerId, payerId), eq(transactionEnrollments.transaction, key))).limit(1);
    if ((prev?.status ?? "not_started") === status) continue;
    const values = {
      status,
      submittedOn: status === "submitted" ? today : prev?.submittedOn ?? null,
      approvedOn: status === "approved" ? today : status === "rejected" || status === "not_started" ? null : prev?.approvedOn ?? null,
      updatedAt: new Date(),
    };
    await db.insert(transactionEnrollments).values({ practiceId, payerId, transaction: key, ...values })
      .onConflictDoUpdate({ target: [transactionEnrollments.practiceId, transactionEnrollments.payerId, transactionEnrollments.transaction], set: values });
    changed.push(`${key}:${status}`);
  }
  if (changed.length) await db.insert(auditLog).values({ practiceId, userId: userId ?? null, action: "transaction_enrollment_saved", entity: "payer", entityId: payerId, details: { changed } });
  return changed;
}

/**
 * Payers the practice billed in the last 90 days whose ERA enrollment is not
 * approved (or marked not required): their remittances will not arrive
 * electronically, so they must be posted from paper EOBs.
 */
export async function eraGaps(db: Db, practiceId: string, now = new Date()) {
  const since = new Date(now.getTime() - 90 * 86_400_000);
  const billed = await db
    .selectDistinct({ id: payers.id, name: payers.name })
    .from(claims)
    .innerJoin(payers, eq(payers.id, claims.payerId))
    .where(and(eq(claims.practiceId, practiceId), ne(payers.type, "self_pay"), gte(claims.createdAt, since), sql`${claims.submittedAt} IS NOT NULL`));
  if (!billed.length) return [];
  const rows = await db.select().from(transactionEnrollments).where(and(eq(transactionEnrollments.practiceId, practiceId), eq(transactionEnrollments.transaction, "era"), inArray(transactionEnrollments.payerId, billed.map((b) => b.id))));
  const status = new Map(rows.map((r) => [r.payerId, r.status]));
  return billed
    .filter((b) => !["approved", "not_required"].includes(status.get(b.id) ?? "not_started"))
    .map((b) => ({ payerId: b.id, payerName: b.name, status: (status.get(b.id) ?? "not_started") as TxnStatus }))
    .sort((a, b) => a.payerName.localeCompare(b.payerName));
}
