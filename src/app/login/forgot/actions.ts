"use server";

import { headers } from "next/headers";
import { getDb } from "@/db";
import { clientIp } from "@/lib/ip";
import { siteOrigin } from "@/lib/origin";
import { requestReset } from "@/server/password-reset";
import { hit } from "@/server/throttle";

/** Always the same answer, so the form cannot reveal who has an account. */
export async function requestResetAction(_prev: { done: boolean } | undefined, formData: FormData): Promise<{ done: boolean }> {
  const email = String(formData.get("email") ?? "").trim();
  if (email.includes("@")) {
    try {
      const db = await getDb();
      // Over the budget, nothing is sent, but the answer stays the same so it reveals nothing.
      if ((await hit(db, "reset", clientIp(await headers()))).ok) await requestReset(db, email, await siteOrigin());
    } catch (e) {
      console.error("password reset request failed", e instanceof Error ? e.message : e);
    }
  }
  return { done: true };
}
