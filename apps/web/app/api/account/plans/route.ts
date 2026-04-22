import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/repositories/users";
import { activateUserPlan, enrollUserInPlan, leaveCurrentPlan } from "@/lib/repositories/plans";

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "请先登录后再添加计划" } },
      { status: 401 }
    );
  }

  const body = await request.json();
  const templateId = typeof body?.templateId === "string" ? body.templateId.trim() : "";
  if (!templateId) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_INPUT", message: "请选择一个训练计划模板" } },
      { status: 400 }
    );
  }

  const plan = await enrollUserInPlan(currentUser.id, templateId);
  if (!plan) {
    return NextResponse.json(
      { ok: false, error: { code: "PLAN_NOT_FOUND", message: "没有找到对应的计划模板" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, data: plan }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "请先登录后再切换计划" } },
      { status: 401 }
    );
  }

  const body = await request.json();
  const planId = typeof body?.planId === "string" ? body.planId.trim() : "";
  if (!planId) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_INPUT", message: "请选择一个训练计划实例" } },
      { status: 400 }
    );
  }

  const plan = await activateUserPlan(currentUser.id, planId);
  if (!plan) {
    return NextResponse.json(
      { ok: false, error: { code: "PLAN_NOT_FOUND", message: "没有找到对应的计划实例" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, data: plan });
}

export async function DELETE() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "请先登录后再退出计划" } },
      { status: 401 }
    );
  }

  const left = await leaveCurrentPlan(currentUser.id);
  if (left === null) {
    return NextResponse.json(
      { ok: false, error: { code: "NO_PLAN_TO_LEAVE", message: "当前没有可退出的训练计划" } },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, data: { left: true } });
}
