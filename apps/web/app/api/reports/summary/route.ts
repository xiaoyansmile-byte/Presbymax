import { NextResponse } from "next/server";
import { getReportSnapshot } from "@/lib/server-report-store";
import type { ReportRange } from "@prosbymax/types";

const reportRanges: Set<ReportRange> = new Set(["7d", "30d", "90d", "all"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const range = url.searchParams.get("range");
  const resolvedRange: ReportRange = range && reportRanges.has(range as ReportRange) ? (range as ReportRange) : "30d";
  return NextResponse.json({ ok: true, data: await getReportSnapshot(resolvedRange) });
}
