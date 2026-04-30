import { NextResponse } from "next/server";
import type { ReportRange } from "@prosbymax/types";
import { getReportSnapshot } from "@/lib/server-report-store";

const reportRanges: Set<ReportRange> = new Set(["7d", "30d", "90d", "all"]);
const exportFormats = new Set(["json", "pdf"]);

function escapePdfText(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function wrapText(value: string, maxLength = 72) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }

    if ((current + " " + word).length <= maxLength) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [value];
}

function buildPdfLines(snapshot: Awaited<ReturnType<typeof getReportSnapshot>>) {
  const lines = [
    "ProsbyMaxMCL Training Report",
    `Range: ${snapshot.rangeLabel}`,
    `Generated at: ${new Date(snapshot.generatedAt).toLocaleString("zh-CN")}`,
    "",
    `User: ${snapshot.currentUser?.displayName ?? "Anonymous"}`,
    `Plan: ${snapshot.currentPlan?.nameSnapshot ?? "No active plan"}`,
    `Status: ${snapshot.currentPlan?.status ?? "N/A"}`,
    "",
    "Recent Records"
  ];

  for (const record of snapshot.recentRecords.slice(0, 12)) {
    lines.push(
      ...wrapText(
        `${new Date(record.startedAt).toLocaleString("zh-CN")} | ${record.trainingLabel} | score ${record.score} | duration ${record.durationSec}s`
      )
    );
  }

  if (snapshot.trend.length > 0) {
    lines.push("", "Trend");
    for (const point of snapshot.trend) {
      lines.push(...wrapText(`${point.label}: ${point.sessions} sessions, ${point.durationSec}s, avg ${point.averageScore}, high ${point.highestScore}`));
    }
  }

  return lines;
}

function buildMinimalPdf(lines: string[]) {
  const content = [
    "BT",
    "/F1 11 Tf",
    "50 790 Td",
    ...lines.flatMap((line, index) => {
      const safeLine = escapePdfText(line);
      if (index === 0) return [`(${safeLine}) Tj`];
      return ["0 -16 Td", `(${safeLine}) Tj`];
    }),
    "ET"
  ].join("\n");

  const objects: string[] = [];
  objects.push("%PDF-1.4");

  const offsets: number[] = [0];
  function pushObject(body: string) {
    offsets.push(objects.join("\n").length + 1);
    objects.push(body);
  }

  pushObject("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj");
  pushObject("2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj");
  pushObject(
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj"
  );
  pushObject("4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj");
  pushObject(`5 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`);

  let cursor = 0;
  const chunks: string[] = [];
  for (const object of objects) {
    chunks.push(object);
    cursor += object.length + 1;
  }

  const body = chunks.join("\n");
  const byteOffsets: number[] = [0];
  let running = "%PDF-1.4\n".length;
  for (const object of objects.slice(1)) {
    byteOffsets.push(running);
    running += `${object}\n`.length;
  }

  const xrefStart = body.length + 1;
  const xref = [
    "xref",
    "0 6",
    "0000000000 65535 f ",
    ...byteOffsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
    "trailer << /Size 6 /Root 1 0 R >>",
    "startxref",
    String(xrefStart),
    "%%EOF"
  ].join("\n");

  return Buffer.from(`${body}\n${xref}`, "utf8");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const range = url.searchParams.get("range");
  const format = url.searchParams.get("format") ?? "json";
  const resolvedRange: ReportRange = range && reportRanges.has(range as ReportRange) ? (range as ReportRange) : "30d";
  const snapshot = await getReportSnapshot(resolvedRange);

  if (!exportFormats.has(format)) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_FORMAT", message: "Unsupported export format." } },
      { status: 400 }
    );
  }

  if (format === "pdf") {
    const pdf = buildMinimalPdf(buildPdfLines(snapshot));
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="prosbymax-report-${resolvedRange}.pdf"`
      }
    });
  }

  return NextResponse.json({
    ok: true,
    data: snapshot
  });
}
