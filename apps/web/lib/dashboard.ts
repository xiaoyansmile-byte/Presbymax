"use client";

import type { DashboardSnapshot } from "@prosbymax/types";

const fallbackUrl = "/api/dashboard";

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

export async function loadDashboardSnapshot(): Promise<DashboardSnapshot | null> {
  return fetchJson<DashboardSnapshot>(fallbackUrl);
}
