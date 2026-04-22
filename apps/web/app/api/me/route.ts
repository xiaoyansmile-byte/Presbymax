import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, updateCurrentUser } from "@/lib/repositories/users";

export async function GET() {
  return NextResponse.json({ ok: true, data: await getCurrentUser() });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "请先登录后再修改资料" } },
      { status: 401 }
    );
  }

  if (body?.role) {
    return NextResponse.json(
      { ok: false, error: { code: "ROLE_LOCKED", message: "角色由登录账号决定，不能通过资料接口修改" } },
      { status: 400 }
    );
  }

  const patch: Parameters<typeof updateCurrentUser>[0] = {};
  if (typeof body?.displayName === "string") patch.displayName = body.displayName;
  if (typeof body?.email === "string") patch.email = body.email;

  const updatedUser = await updateCurrentUser(patch);

  return NextResponse.json({ ok: true, data: updatedUser });
}
