import { NextResponse } from "next/server";
import { getReportSnapshot } from "@/lib/server-report-store";

export async function GET() {
  return NextResponse.json({ ok: true, data: await getReportSnapshot() });
}
