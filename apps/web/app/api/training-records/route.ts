import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/repositories/users";
import { getCurrentPlanForUser } from "@/lib/repositories/plans";
import { createStoredTrainingRecord, listTrainingRecords } from "@/lib/repositories/training-records";
import type { TrainingRecordQuery, TrainingType } from "@prosbymax/types";

const trainingTypes: Set<TrainingType> = new Set([
  "optictrain-navigation",
  "gabor-match",
  "flicker-gabor",
  "brightness",
  "reading",
  "glare",
  "tunnel"
]);

function parseQuery(request: NextRequest): TrainingRecordQuery {
  const url = request.nextUrl;
  const trainingType = url.searchParams.get("trainingType");
  return {
    userId: url.searchParams.get("userId") || undefined,
    planId: url.searchParams.get("planId") || undefined,
    trainingType: trainingType && trainingTypes.has(trainingType as TrainingType) ? (trainingType as TrainingType) : undefined,
    startedFrom: url.searchParams.get("startedFrom") || undefined,
    startedTo: url.searchParams.get("startedTo") || undefined,
    limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined
  };
}

export async function GET(request: NextRequest) {
  const query = parseQuery(request);
  const currentUser = await getCurrentUser();
  if (currentUser) {
    query.userId = query.userId ?? currentUser.id;
    if (!query.planId) {
      const currentPlan = await getCurrentPlanForUser(currentUser.id);
      query.planId = currentPlan?.id;
    }
  }

  return NextResponse.json({ ok: true, data: await listTrainingRecords(query) });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const currentUser = await getCurrentUser();
  const currentPlan = currentUser ? await getCurrentPlanForUser(currentUser.id) : null;
  const record = await createStoredTrainingRecord({
    ...body,
    userId: currentUser?.id ?? body?.userId ?? null,
    planId: currentPlan?.id ?? body?.planId ?? null
  });
  return NextResponse.json({ ok: true, data: record }, { status: 201 });
}
