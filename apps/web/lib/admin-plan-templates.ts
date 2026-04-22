"use client";

import type { PlanTemplate } from "@prosbymax/types";
import type { PlanTemplateVersion } from "@prosbymax/types";

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

export async function loadAdminPlanTemplates(): Promise<PlanTemplate[] | null> {
  return fetchJson<PlanTemplate[]>("/api/admin/plan-templates");
}

export async function saveAdminPlanTemplates(templates: PlanTemplate[]): Promise<PlanTemplate[] | null> {
  return fetchJson<PlanTemplate[]>("/api/admin/plan-templates", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templates })
  });
}

export async function loadAdminPlanTemplateHistory(): Promise<PlanTemplateVersion[] | null> {
  return fetchJson<PlanTemplateVersion[]>("/api/admin/plan-templates/history");
}
