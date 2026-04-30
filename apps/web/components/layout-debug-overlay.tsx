"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type LayoutNodeReport = {
  label: string;
  rect: {
    left: number;
    right: number;
    width: number;
  };
  scrollWidth: number;
  clientWidth: number;
  overflowLeft: boolean;
  overflowRight: boolean;
  selector: string;
};

type LayoutReport = {
  viewport: {
    innerWidth: number;
    visualViewportWidth: number | null;
    clientWidth: number;
    bodyClientWidth: number;
    documentScrollWidth: number;
  };
  nodes: LayoutNodeReport[];
  shellNodes: LayoutNodeReport[];
};

function buildElementSelector(element: Element) {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && parts.length < 4) {
    const tag = current.tagName.toLowerCase();
    const className = current.className;
    const classPart =
      typeof className === "string"
        ? className
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((classToken) => `.${classToken.replace(/[^a-zA-Z0-9_-]/g, "")}`)
            .join("")
        : "";
    parts.unshift(`${tag}${classPart}`);
    current = current.parentElement;
  }

  return parts.join(" > ");
}

function collectNodeReport(element: Element, viewportWidth: number): LayoutNodeReport {
  const rect = element.getBoundingClientRect();
  const clientWidth = (element as HTMLElement).clientWidth ?? 0;
  const scrollWidth = (element as HTMLElement).scrollWidth ?? 0;

  return {
    label: (element as HTMLElement).dataset.layoutDebugLabel || buildElementSelector(element),
    rect: {
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      width: Math.round(rect.width)
    },
    scrollWidth: Math.round(scrollWidth),
    clientWidth: Math.round(clientWidth),
    overflowLeft: rect.left < -1,
    overflowRight: rect.right > viewportWidth + 1,
    selector: buildElementSelector(element)
  };
}

export function LayoutDebugOverlay() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const enabled = searchParams.get("debug") === "layout";
  const [report, setReport] = useState<LayoutReport | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setReport(null);
      return;
    }

    const highlightClass = "layout-debug-highlight";
    const style = document.createElement("style");
    style.textContent = `
      .${highlightClass} {
        outline: 2px solid rgba(225, 29, 72, 0.95) !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.15) !important;
      }
    `;
    document.head.appendChild(style);

    const update = () => {
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const root = document.documentElement;
      const body = document.body;
      const nodes = Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter((element) => {
          if (element.closest("[data-layout-debug-overlay='true']")) return false;
          const rect = element.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return false;
          if (getComputedStyle(element).visibility === "hidden") return false;
          return rect.left < -1 || rect.right > viewportWidth + 1 || element.scrollWidth > element.clientWidth + 1;
        })
        .slice(0, 20);

      const shellNodes = Array.from(document.querySelectorAll<HTMLElement>(".app-shell")).map((element) =>
        collectNodeReport(element, viewportWidth)
      );

      const nextReport: LayoutReport = {
        viewport: {
          innerWidth: Math.round(window.innerWidth),
          visualViewportWidth: Math.round(window.visualViewport?.width ?? 0) || null,
          clientWidth: Math.round(root.clientWidth),
          bodyClientWidth: Math.round(body.clientWidth),
          documentScrollWidth: Math.round(root.scrollWidth)
        },
        nodes: nodes.map((element) => collectNodeReport(element, viewportWidth)),
        shellNodes
      };

      document.querySelectorAll(`.${highlightClass}`).forEach((element) => {
        element.classList.remove(highlightClass);
      });
      nodes.forEach((element) => {
        element.classList.add(highlightClass);
      });

      setReport(nextReport);
    };

    update();

    const scheduledUpdate = () => {
      window.requestAnimationFrame(update);
    };

    window.addEventListener("resize", scheduledUpdate);
    window.addEventListener("scroll", scheduledUpdate, { passive: true });
    window.visualViewport?.addEventListener("resize", scheduledUpdate);
    window.visualViewport?.addEventListener("scroll", scheduledUpdate);

    return () => {
      window.removeEventListener("resize", scheduledUpdate);
      window.removeEventListener("scroll", scheduledUpdate);
      window.visualViewport?.removeEventListener("resize", scheduledUpdate);
      window.visualViewport?.removeEventListener("scroll", scheduledUpdate);
      document.querySelectorAll(`.${highlightClass}`).forEach((element) => {
        element.classList.remove(highlightClass);
      });
      style.remove();
    };
  }, [enabled, pathname]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [pathname, enabled]);

  if (!enabled || !report) return null;

  const activeShell = report.shellNodes[selectedIndex] ?? report.shellNodes[0];

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-center px-3 pb-3 sm:px-4">
      <div
        data-layout-debug-overlay="true"
        className="pointer-events-auto w-full max-w-[min(92vw,38rem)] overflow-hidden rounded-[20px] border border-rose-200 bg-white/96 shadow-[0_20px_50px_rgba(15,23,42,0.22)] backdrop-blur"
      >
        <div className="flex items-center justify-between border-b border-rose-100 bg-rose-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-rose-700">Layout Debug</p>
            <p className="text-xs text-rose-500">{pathname}</p>
          </div>
          <p className="text-xs font-medium text-rose-600">only in client</p>
        </div>

        <div className="grid gap-3 p-4 text-[12px] text-slate-700">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Metric label="innerWidth" value={report.viewport.innerWidth} />
            <Metric label="visualViewport" value={report.viewport.visualViewportWidth ?? "null"} />
            <Metric label="clientWidth" value={report.viewport.clientWidth} />
            <Metric label="bodyWidth" value={report.viewport.bodyClientWidth} />
            <Metric label="scrollWidth" value={report.viewport.documentScrollWidth} />
          </div>

          <div className="rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">app-shells</p>
              <p className="text-[11px] text-slate-400">{report.shellNodes.length} found</p>
            </div>
            <div className="mt-2 space-y-2">
              {report.shellNodes.map((node, index) => {
                const selected = index === selectedIndex;
                return (
                  <button
                    key={`${node.selector}-${index}`}
                    type="button"
                    className={[
                      "block w-full rounded-[12px] border px-3 py-2 text-left transition",
                      selected ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-white"
                    ].join(" ")}
                    onClick={() => setSelectedIndex(index)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-medium text-slate-800">{node.label}</span>
                      <span className="shrink-0 text-slate-500">
                        L{node.rect.left} / R{report.viewport.visualViewportWidth ? Math.round(report.viewport.visualViewportWidth - node.rect.right) : "?"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            {activeShell ? (
              <div className="mt-3 rounded-[12px] bg-white px-3 py-2 text-[11px] text-slate-600">
                <p className="font-semibold text-slate-700">selected shell</p>
                <p className="mt-1 break-words">selector: {activeShell.selector}</p>
                <p className="mt-1">
                  rect: left {activeShell.rect.left}, right {activeShell.rect.right}, width {activeShell.rect.width}
                </p>
                <p className="mt-1">
                  clientWidth {activeShell.clientWidth}, scrollWidth {activeShell.scrollWidth}
                </p>
              </div>
            ) : null}
          </div>

          <div className="rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">overflow nodes</p>
              <p className="text-[11px] text-slate-400">{report.nodes.length} found</p>
            </div>
            <div className="mt-2 max-h-44 space-y-2 overflow-auto pr-1">
              {report.nodes.length === 0 ? (
                <p className="text-slate-500">no overflow elements detected</p>
              ) : (
                report.nodes.map((node) => (
                  <div key={node.selector} className="rounded-[12px] border border-rose-200 bg-white px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 break-words font-medium text-slate-800">{node.label}</p>
                      <span className="shrink-0 text-rose-600">
                        {node.overflowLeft ? "left" : ""}
                        {node.overflowLeft && node.overflowRight ? " · " : ""}
                        {node.overflowRight ? "right" : ""}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      L{node.rect.left} R{node.rect.right} W{node.rect.width} | client {node.clientWidth} / scroll {node.scrollWidth}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[14px] border border-slate-200 bg-white px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
