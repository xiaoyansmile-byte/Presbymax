import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/repositories/users";
import { listPlanTemplateVersions } from "@/lib/repositories/plans";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (currentUser?.role !== "admin") {
    return NextResponse.json(
      { ok: false, error: { code: "FORBIDDEN", message: "当前身份无权查看模板历史" } },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true, data: await listPlanTemplateVersions() });
}
