import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, createSessionForUser } from "@/lib/repositories/users";

const authCookieName = "prosbymax-session";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_INPUT", message: "请输入邮箱和密码" } },
      { status: 400 }
    );
  }

  const user = await authenticateUser(email, password);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_CREDENTIALS", message: "邮箱或密码不正确" } },
      { status: 401 }
    );
  }

  const token = await createSessionForUser(user.id);
  const response = NextResponse.json({ ok: true, data: user });
  response.cookies.set(authCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30
  });

  return response;
}
