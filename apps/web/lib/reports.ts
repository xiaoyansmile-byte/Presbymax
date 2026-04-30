"use client";

import type { ReportRange, ReportSnapshot } from "@prosbymax/types";

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

export async function loadReportSnapshot(range = "30d"): Promise<ReportSnapshot | null> {
  return fetchJson<ReportSnapshot>(`/api/reports/summary?range=${encodeURIComponent(range)}`);
}

export async function exportReport(range: ReportRange, format: "json" | "pdf") {
  const response = await fetch(`/api/reports/export?range=${encodeURIComponent(range)}&format=${format}`);
  if (!response.ok) return null;
  return response;
}
