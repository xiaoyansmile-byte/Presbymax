"use client";

import {
  defaultGaborMatchConfig,
  normalizeGaborMatchConfig
} from "@prosbymax/core";
import type { GaborMatchConfig, TrainingConfigVersion } from "@prosbymax/types";

const storageKey = "prosbymax-admin-gabor-match-config";

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

export function loadGaborMatchConfig(): GaborMatchConfig {
  if (typeof window === "undefined") return defaultGaborMatchConfig;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return defaultGaborMatchConfig;
    return normalizeGaborMatchConfig(JSON.parse(raw));
  } catch (error) {
    return defaultGaborMatchConfig;
  }
}

export function saveGaborMatchConfig(config: GaborMatchConfig) {
  window.localStorage.setItem(storageKey, JSON.stringify(normalizeGaborMatchConfig(config)));
}

export async function loadGaborMatchConfigFromApi() {
  const version = await fetchJson<TrainingConfigVersion<GaborMatchConfig> | null>("/api/training-configs/gabor-match/active");
  const config = version?.config;
  if (!config) return loadGaborMatchConfig();
  const normalized = normalizeGaborMatchConfig(config);
  window.localStorage.setItem(storageKey, JSON.stringify(normalized));
  return normalized;
}

export async function saveGaborMatchConfigToApi(config: GaborMatchConfig) {
  const result = await fetchJson("/api/training-configs/gabor-match/active", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      config: normalizeGaborMatchConfig(config)
    })
  });

  if (result) {
    saveGaborMatchConfig(config);
  }

  return result;
}
