"use client";

import type { AccountSnapshot } from "@prosbymax/types";
import type { PlanInstanceEvent } from "@prosbymax/types";

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

export async function loadAccountSnapshot(): Promise<AccountSnapshot | null> {
  return fetchJson<AccountSnapshot>("/api/account");
}

export async function loadAccountPlanEvents(): Promise<PlanInstanceEvent[] | null> {
  return fetchJson<PlanInstanceEvent[]>("/api/account/plan-events");
}

export async function addPlanToAccount(templateId: string) {
  return fetchJson("/api/account/plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templateId })
  });
}

export async function switchActivePlan(planId: string) {
  return fetchJson("/api/account/plans", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId })
  });
}

export async function leaveCurrentPlan() {
  return fetchJson("/api/account/plans", {
    method: "DELETE"
  });
}
