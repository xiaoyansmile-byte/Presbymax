import { NextResponse } from "next/server";
import { listPlanCatalog } from "@/lib/repositories/plans";

export async function GET() {
  return NextResponse.json({ ok: true, data: await listPlanCatalog() });
}
