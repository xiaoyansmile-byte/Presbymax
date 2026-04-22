import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/repositories/users";

const authCookieName = "prosbymax-session";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(authCookieName)?.value ?? null;

  if (token) {
    await deleteSession(token);
  }

  const response = NextResponse.json({ ok: true, data: true });
  response.cookies.set(authCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0
  });

  return response;
}
