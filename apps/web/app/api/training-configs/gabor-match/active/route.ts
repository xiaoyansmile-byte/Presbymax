import { NextRequest, NextResponse } from "next/server";
import {
  activateGaborMatchVersion,
  getActiveGaborMatchConfigVersion,
  saveGaborMatchDraftVersion
} from "@/lib/repositories/training-configs";
import { getCurrentUser } from "@/lib/repositories/users";

export async function GET() {
  return NextResponse.json({ ok: true, data: await getActiveGaborMatchConfigVersion() });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const currentUser = await getCurrentUser();
  if (currentUser?.role !== "admin") {
    return NextResponse.json(
      { ok: false, error: { code: "FORBIDDEN", message: "当前身份无权修改管理员配置" } },
      { status: 403 }
    );
  }

  const draft = await saveGaborMatchDraftVersion(body.config ?? body, {
    createdBy: currentUser.id,
    notes: body.notes ?? null
  });
  const active = await activateGaborMatchVersion(draft.id, { activatedBy: currentUser.id });
  return NextResponse.json({ ok: true, data: active ?? draft });
}
