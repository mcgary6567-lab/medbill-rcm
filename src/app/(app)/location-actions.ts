"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import type { FormResult } from "@/components/action-form";
import { saveLocation, setLocationActive } from "@/server/locations";

export async function saveLocationAction(id: string | null, _prev: FormResult, fd: FormData): Promise<FormResult> {
  const s = await requireRole(["admin"]);
  const f = (k: string) => String(fd.get(k) ?? "");
  try {
    await saveLocation(await getDb(), s.practiceId, id, { name: f("name"), npi: f("npi"), address1: f("address1"), city: f("city"), state: f("state"), zip: f("zip"), placeOfService: f("placeOfService") }, s.userId);
    revalidatePath("/settings/locations");
    return { ok: true, message: id ? "Location saved" : "Location added" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not save" };
  }
}

export async function setLocationActiveAction(id: string, active: boolean, _prev: FormResult): Promise<FormResult> {
  const s = await requireRole(["admin"]);
  try {
    await setLocationActive(await getDb(), s.practiceId, id, active, s.userId);
    revalidatePath("/settings/locations");
    return { ok: true, message: active ? "Location reactivated" : "Location deactivated; past visits keep it" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not change it" };
  }
}
