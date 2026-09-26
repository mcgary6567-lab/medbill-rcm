import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { schema } from "@/db";
import { testDb } from "@/test/db";
import { clearConfigCache } from "./integrations";
import { handleStripeEvent } from "./portal";
import { checkTerminalPayment, createSimulatedReader, simulateTap, startTerminalPayment } from "./terminal";

type Reader = { id: string; label: string | null; device_type: string; status: string | null; livemode: boolean; action: { type: string; status: string; failure_code: string | null; failure_message: string | null; process_payment_intent?: { payment_intent: string } } | null };

/** A stand-in for Stripe that behaves like the simulated reader. */
let fakes = 0;
function fakeStripe() {
  const prefix = `pi_f${++fakes}x`;
  const intents = new Map<string, { status: string; amount: number }>();
  const reader: Reader = { id: "tmr_sim1", label: "Sim", device_type: "simulated_wisepos_e", status: "online", livemode: false, action: null };
  let n = 0;
  let decline = false;
  let busy = false;
  const calls: string[] = [];
  const stripe = {
    listReaders: async () => ({ data: [reader] }),
    getReader: async () => reader,
    createLocation: async () => { calls.push("location"); return { id: "tml_1" }; },
    registerReader: async (p: { registrationCode: string }) => { calls.push(`register ${p.registrationCode}`); return reader; },
    createCardPresentIntent: async (p: { amountCents: number; idempotencyKey: string }) => { const id = `${prefix}${++n}`; intents.set(id, { status: "requires_payment_method", amount: p.amountCents }); calls.push(`intent ${p.amountCents} ${p.idempotencyKey.slice(0, 9)}`); return { id, status: "requires_payment_method" }; },
    processPaymentIntent: async (_r: string, pi: string) => {
      if (busy) throw new Error("Stripe: Reader is currently busy processing another request.");
      reader.action = { type: "process_payment_intent", status: "in_progress", failure_code: null, failure_message: null, process_payment_intent: { payment_intent: pi } };
      return reader;
    },
    presentPaymentMethod: async () => {
      const pi = reader.action!.process_payment_intent!.payment_intent;
      if (decline) { reader.action = { ...reader.action!, status: "failed", failure_code: "card_declined", failure_message: "Your card was declined." }; return reader; }
      intents.get(pi)!.status = "succeeded";
      reader.action = { ...reader.action!, status: "succeeded" };
      return reader;
    },
    getPaymentIntent: async (id: string) => ({ id, status: intents.get(id)!.status, payment_method: null, customer: null }),
    cancelPaymentIntent: async (id: string) => { intents.get(id)!.status = "canceled"; calls.push(`cancel ${id}`); return { id, status: "canceled" }; },
    cancelReaderAction: async () => reader,
  };
  return { stripe, calls, setDecline: (v: boolean) => { decline = v; }, setBusy: (v: boolean) => { busy = v; } };
}

describe("front desk card reader", () => {
  let t: Awaited<ReturnType<typeof testDb>>;
  let patientId: string;
  beforeAll(async () => {
    t = await testDb();
    [{ id: patientId }] = await t.db.select({ id: schema.patients.id }).from(schema.patients).where(eq(schema.patients.practiceId, t.practiceId)).limit(1);
  });
  afterAll(async () => { await t?.close(); });
  afterEach(() => { vi.unstubAllEnvs(); clearConfigCache(); });

  const ledger = () => t.db.select().from(schema.ledgerEntries).where(and(eq(schema.ledgerEntries.patientId, patientId), eq(schema.ledgerEntries.note, "Patient payment (card, front desk reader)")));

  it("makes a simulated reader only in test mode", async () => {
    const f = fakeStripe();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_abcdefghijklmnop");
    clearConfigCache();
    await expect(createSimulatedReader(t.db, t.practiceId, { stripe: f.stripe })).rejects.toThrow(/test mode/);
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_abcdefghijklmnop");
    clearConfigCache();
    expect((await createSimulatedReader(t.db, t.practiceId, { stripe: f.stripe })).id).toBe("tmr_sim1");
    expect(f.calls).toEqual(["location", "register simulated-wpe"]);
  });

  it("posts a tapped card once, whether checked, tapped or reported by the webhook", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_abcdefghijklmnop");
    clearConfigCache();
    const f = fakeStripe();
    await expect(startTerminalPayment(t.db, t.practiceId, { patientId, amountCents: 10, readerId: "tmr_sim1" }, { stripe: f.stripe })).rejects.toThrow(/between/);
    const row = await startTerminalPayment(t.db, t.practiceId, { patientId, amountCents: 4500, readerId: "tmr_sim1" }, { stripe: f.stripe, userId: t.userId });
    expect((await checkTerminalPayment(t.db, t.practiceId, row.id, { stripe: f.stripe })).status).toBe("waiting");
    expect((await simulateTap(t.db, t.practiceId, row.id, { stripe: f.stripe })).status).toBe("succeeded");
    await checkTerminalPayment(t.db, t.practiceId, row.id, { stripe: f.stripe });
    await handleStripeEvent(t.db, { id: "evt_1", type: "payment_intent.succeeded", data: { object: { id: row.paymentIntentId, metadata: { terminal_payment_id: row.id } } } } as never);
    const posted = await ledger();
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ type: "patient_payment", amountCents: 4500 });
    // A webhook for another practice's payment is refused.
    await expect(handleStripeEvent(t.db, { id: "evt_2", type: "payment_intent.succeeded", data: { object: { id: row.paymentIntentId, metadata: { terminal_payment_id: row.id } } } } as never, undefined, "00000000-0000-4000-8000-000000000000")).rejects.toThrow(/another practice/);
  });

  it("records a decline without posting, and releases the intent when the reader is busy", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_abcdefghijklmnop");
    clearConfigCache();
    const f = fakeStripe();
    const before = (await ledger()).length;
    f.setDecline(true);
    const row = await startTerminalPayment(t.db, t.practiceId, { patientId, amountCents: 2000, readerId: "tmr_sim1" }, { stripe: f.stripe });
    const r = await simulateTap(t.db, t.practiceId, row.id, { stripe: f.stripe });
    expect(r).toMatchObject({ status: "failed", failure: "Your card was declined." });
    expect(f.calls).toContain(`cancel ${row.paymentIntentId}`);
    expect((await ledger()).length).toBe(before);

    f.setBusy(true);
    await expect(startTerminalPayment(t.db, t.practiceId, { patientId, amountCents: 2000, readerId: "tmr_sim1" }, { stripe: f.stripe })).rejects.toThrow(/busy/);
    const [last] = await t.db.select().from(schema.terminalPayments).where(eq(schema.terminalPayments.status, "failed")).orderBy(schema.terminalPayments.createdAt);
    expect(last).toBeTruthy();
    expect(f.calls.filter((c) => c.startsWith("cancel"))).toHaveLength(2);
  });
});
