"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { CAN_WRITE, requireRole } from "@/lib/auth";
import type { FormResult } from "@/components/action-form";
import { cancelTerminalPayment, checkTerminalPayment, createSimulatedReader, simulateTap, startTerminalPayment } from "@/server/terminal";

const fail = (e: unknown, fallback: string): FormResult => ({ ok: false, message: e instanceof Error ? e.message : fallback });
const done = (patientId: string) => revalidatePath(`/patients/${patientId}`);
const said = (status: string, failure: string | null) =>
  status === "succeeded" ? "Paid and posted to the patient's account" : status === "failed" ? `Not paid: ${failure ?? "declined"}` : status === "canceled" ? "Cancelled" : "Waiting for the card on the reader";

export async function startTerminalPaymentAction(patientId: string, _prev: FormResult, fd: FormData): Promise<FormResult> {
  const s = await requireRole(CAN_WRITE);
  try {
    await startTerminalPayment(await getDb(), s.practiceId, { patientId, amountCents: Math.round(parseFloat(String(fd.get("amount") ?? "0")) * 100), readerId: String(fd.get("readerId") ?? "") }, { userId: s.userId });
    done(patientId);
    return { ok: true, message: "Sent to the reader. Ask the patient to tap or insert their card." };
  } catch (e) {
    return fail(e, "Could not reach the reader");
  }
}

export async function checkTerminalPaymentAction(patientId: string, id: string, _prev: FormResult): Promise<FormResult> {
  const s = await requireRole(CAN_WRITE);
  try {
    const r = await checkTerminalPayment(await getDb(), s.practiceId, id);
    done(patientId);
    return { ok: r.status !== "failed", message: said(r.status, r.failure) };
  } catch (e) {
    return fail(e, "Could not check the payment");
  }
}

export async function cancelTerminalPaymentAction(patientId: string, id: string, _prev: FormResult): Promise<FormResult> {
  const s = await requireRole(CAN_WRITE);
  try {
    const r = await cancelTerminalPayment(await getDb(), s.practiceId, id);
    done(patientId);
    return { ok: true, message: said(r.status, r.failure) };
  } catch (e) {
    return fail(e, "Could not cancel");
  }
}

export async function simulateTapAction(patientId: string, id: string, _prev: FormResult): Promise<FormResult> {
  const s = await requireRole(CAN_WRITE);
  try {
    const r = await simulateTap(await getDb(), s.practiceId, id);
    done(patientId);
    return { ok: r.status !== "failed", message: said(r.status, r.failure) };
  } catch (e) {
    return fail(e, "Could not simulate the card");
  }
}

export async function createSimulatedReaderAction(patientId: string, _prev: FormResult): Promise<FormResult> {
  const s = await requireRole(["admin"]);
  try {
    const r = await createSimulatedReader(await getDb(), s.practiceId, { userId: s.userId });
    done(patientId);
    return { ok: true, message: `Simulated reader ${r.id} is ready` };
  } catch (e) {
    return fail(e, "Could not create a simulated reader");
  }
}
