"use client";

import type { AppUser } from "@prosbymax/types";

const authChangedEvent = "prosbymax-auth-changed";

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

export function notifyAuthChanged() {
  window.dispatchEvent(new Event(authChangedEvent));
}

export function subscribeAuthChanges(listener: () => void) {
  window.addEventListener(authChangedEvent, listener);
  return () => window.removeEventListener(authChangedEvent, listener);
}

export async function loadCurrentUserFromApi(): Promise<AppUser | null> {
  return fetchJson<AppUser | null>("/api/me");
}

export async function loginWithCredentials(input: { email: string; password: string }) {
  return fetchJson<AppUser>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

export async function registerWithCredentials(input: { displayName: string; email: string; password: string; templateId?: string }) {
  return fetchJson<AppUser>("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

export async function logoutFromApi() {
  return fetchJson<boolean>("/api/auth/logout", {
    method: "POST"
  });
}

export async function updateCurrentUserProfile(input: { displayName?: string; email?: string }) {
  return fetchJson<AppUser>("/api/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}
