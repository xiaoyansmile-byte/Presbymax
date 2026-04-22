import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/repositories/users";
import { listPlanInstanceEvents } from "@/lib/repositories/plans";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "请先登录后查看计划时间线" } },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    data: await listPlanInstanceEvents(currentUser.id)
  });
}
