import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, updateCurrentUser } from "@/lib/repositories/users";

const genderValues = new Set(["male", "female", "other"]);
const surgeryTypeValues = new Set(["smile", "lisk", "prosbymax", "mcl"]);

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
  if (body?.age === null || body?.age === "") {
    patch.age = null;
  } else if (typeof body?.age === "number" && Number.isFinite(body.age)) {
    patch.age = Math.max(0, Math.round(body.age));
  } else if (typeof body?.age === "string" && body.age.trim()) {
    const parsedAge = Number(body.age);
    if (Number.isFinite(parsedAge)) patch.age = Math.max(0, Math.round(parsedAge));
  }

  if (body?.gender === null || body?.gender === "") {
    patch.gender = null;
  } else if (typeof body?.gender === "string" && genderValues.has(body.gender)) {
    patch.gender = body.gender as "male" | "female" | "other";
  }

  if (body?.surgeryType === null || body?.surgeryType === "") {
    patch.surgeryType = null;
  } else if (typeof body?.surgeryType === "string" && surgeryTypeValues.has(body.surgeryType)) {
    patch.surgeryType = body.surgeryType as "smile" | "lisk" | "prosbymax" | "mcl";
  }

  if (body?.surgeryAt === null || body?.surgeryAt === "") {
    patch.surgeryAt = null;
  } else if (typeof body?.surgeryAt === "string") {
    patch.surgeryAt = body.surgeryAt;
  }

  const updatedUser = await updateCurrentUser(patch);

  return NextResponse.json({ ok: true, data: updatedUser });
}
