import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/repositories/users";
import { listAdminUserSummaries } from "@/lib/repositories/training-records";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (currentUser?.role !== "admin") {
    return NextResponse.json(
      { ok: false, error: { code: "FORBIDDEN", message: "当前身份无权查看用户列表" } },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true, data: await listAdminUserSummaries() });
}
