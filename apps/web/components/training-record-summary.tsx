"use client";

import { useEffect, useState } from "react";
import { summarizeRecords } from "@prosbymax/core";
import type { TrainingRecord } from "@prosbymax/types";
import { loadTrainingRecords, loadTrainingRecordsFromApi, subscribeTrainingRecords } from "@/lib/training-records";
import { StatCard } from "@/components/stat-card";

function getDisplayRecords() {
  const records = loadTrainingRecords();
  return records;
}

export function TrainingRecordSummary() {
  const [records, setRecords] = useState<TrainingRecord[]>([]);

  useEffect(() => {
    let cancelled = false;

    void loadTrainingRecordsFromApi().then((nextRecords) => {
      if (!cancelled) setRecords(nextRecords);
    });

    const unsubscribe = subscribeTrainingRecords(() => setRecords(getDisplayRecords()));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const stats = summarizeRecords(records);

  return (
    <section className="grid grid-cols-2 gap-3">
      <StatCard label="练习次数" value={stats.totalSessions} tone="blue" />
      <StatCard label="最高分" value={stats.highestScore} tone="green" />
      <StatCard label="总时长" value={`${Math.round(stats.totalDurationSec / 60)}m`} tone="violet" />
      <StatCard label="平均分" value={stats.averageScore} tone="amber" />
    </section>
  );
}
