import { NextResponse } from "next/server";
import { getDashboardSnapshot } from "@/lib/server-dashboard-store";

export async function GET() {
  return NextResponse.json({ ok: true, data: await getDashboardSnapshot() });
}
