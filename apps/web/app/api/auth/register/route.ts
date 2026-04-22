import { NextRequest, NextResponse } from "next/server";
import { createSessionForUser, createUserAccount, findUserByEmail } from "@/lib/repositories/users";

const authCookieName = "prosbymax-session";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const templateId = typeof body?.templateId === "string" ? body.templateId.trim() : "";

  if (!displayName || !email || !password) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_INPUT", message: "请完整填写姓名、邮箱和密码" } },
      { status: 400 }
    );
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return NextResponse.json(
      { ok: false, error: { code: "EMAIL_EXISTS", message: "这个邮箱已经注册过了" } },
      { status: 409 }
    );
  }

  const user = await createUserAccount({
    displayName,
    email,
    password,
    role: "user",
    templateId: templateId || undefined
  });

  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: "REGISTER_FAILED", message: "注册失败，请稍后再试" } },
      { status: 500 }
    );
  }

  const token = await createSessionForUser(user.id);
  const response = NextResponse.json({ ok: true, data: user }, { status: 201 });
  response.cookies.set(authCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30
  });

  return response;
}
