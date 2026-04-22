"use client";

import type { PlanTemplate } from "@prosbymax/types";

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(input, init);
    if (!response.ok) return null;
    const payload = (await response.json()) as { ok?: boolean; data?: T };
    return payload?.ok ? (payload.data ?? null) : null;
  } catch {
    return null;
  }
}

export async function loadPlanTemplatesFromApi(): Promise<PlanTemplate[] | null> {
  return fetchJson<PlanTemplate[]>("/api/plan-templates");
}
