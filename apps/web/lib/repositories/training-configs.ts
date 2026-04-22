import type { GaborMatchConfig, TrainingConfigVersion } from "@prosbymax/types";
import { normalizeGaborMatchConfig } from "@prosbymax/core";
import { loadStore, updateStore } from "@/lib/persistent-store";

export async function getActiveGaborMatchConfigVersion(): Promise<TrainingConfigVersion<GaborMatchConfig> | null> {
  const store = await loadStore();
  return store.trainingConfigVersions.find((version) => version.status === "active") ?? null;
}

export async function saveGaborMatchDraftVersion(
  config: GaborMatchConfig,
  options?: { createdBy?: string | null; notes?: string | null }
): Promise<TrainingConfigVersion<GaborMatchConfig>> {
  const store = await loadStore();
  const latestVersion = store.trainingConfigVersions.reduce((max, version) => Math.max(max, version.version), 0);
  const nextVersion: TrainingConfigVersion<GaborMatchConfig> = {
    id: `gabor-match-v${latestVersion + 1}`,
    trainingType: "gabor-match",
    version: latestVersion + 1,
    status: "draft",
    config: normalizeGaborMatchConfig(config),
    createdBy: options?.createdBy ?? null,
    createdAt: new Date().toISOString(),
    activatedAt: null,
    notes: options?.notes ?? null
  };

  await updateStore((current) => ({
    ...current,
    trainingConfigVersions: [nextVersion, ...current.trainingConfigVersions.filter((entry) => entry.status !== "draft")]
  }));

  return nextVersion;
}

export async function activateGaborMatchVersion(
  versionId: string,
  options?: { activatedBy?: string | null }
): Promise<TrainingConfigVersion<GaborMatchConfig> | null> {
  const store = await loadStore();
  const target = store.trainingConfigVersions.find((version) => version.id === versionId);
  if (!target) return null;

  const activatedAt = new Date().toISOString();
  const nextVersions = store.trainingConfigVersions.map((version) => {
    if (version.id === versionId) {
      return {
        ...version,
        status: "active" as const,
        activatedAt,
        createdBy: version.createdBy ?? options?.activatedBy ?? null
      };
    }

    if (version.trainingType === "gabor-match" && version.id !== versionId && version.status === "active") {
      return { ...version, status: "archived" as const };
    }

    return version;
  });

  await updateStore((current) => ({
    ...current,
    trainingConfigVersions: nextVersions
  }));

  return (await getActiveGaborMatchConfigVersion()) ?? null;
}
