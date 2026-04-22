import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/repositories/users";
import { listPlanCatalog, savePlanCatalog } from "@/lib/repositories/plans";
import type { PlanTemplate } from "@prosbymax/types";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (currentUser?.role !== "admin") {
    return NextResponse.json(
      { ok: false, error: { code: "FORBIDDEN", message: "当前身份无权查看计划模板" } },
      { status: 403 }
    );
  }

  return NextResponse.json({ ok: true, data: await listPlanCatalog() });
}

function normalizeTemplates(payload: unknown): PlanTemplate[] | null {
  if (!payload || typeof payload !== "object") return null;
  const templates = (payload as { templates?: unknown }).templates;
  if (!Array.isArray(templates)) return null;
  return templates as PlanTemplate[];
}

export async function PUT(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (currentUser?.role !== "admin") {
    return NextResponse.json(
      { ok: false, error: { code: "FORBIDDEN", message: "当前身份无权修改计划模板" } },
      { status: 403 }
    );
  }

  const body = await request.json();
  const templates = normalizeTemplates(body);
  if (!templates) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_INPUT", message: "请提供有效的计划模板列表" } },
      { status: 400 }
    );
  }

  const saved = await savePlanCatalog(templates, { changedBy: currentUser.id, notes: body.notes ?? null });
  return NextResponse.json({ ok: true, data: saved });
}
