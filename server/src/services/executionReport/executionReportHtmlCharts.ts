import type { FailureSeverity } from "./types.js";
import { esc, sevClass } from "./executionReportHtmlShared.js";

export function renderPieChart(
  slices: { label: string; value: number }[],
  size = 140
): string {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const colors: Record<string, string> = {
    Passed: "#16a34a",
    Failed: "#dc2626",
    Skipped: "#94a3b8",
  };
  let angle = -90;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const paths: string[] = [];

  for (const slice of slices) {
    if (slice.value <= 0) continue;
    const sweep = (slice.value / total) * 360;
    const a0 = (angle * Math.PI) / 180;
    const a1 = ((angle + sweep) * Math.PI) / 180;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const large = sweep > 180 ? 1 : 0;
    paths.push(
      `<path d="M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z" fill="${colors[slice.label] ?? "#64748b"}" />`
    );
    angle += sweep;
  }

  const legend = slices
    .map(
      (s) =>
        `<span class="legend-item"><i style="background:${colors[s.label] ?? "#64748b"}"></i>${esc(s.label)} ${s.value}</span>`
    )
    .join("");

  return `<div class="chart-pie-wrap">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Pass fail chart">${paths.join("")}</svg>
    <div class="chart-legend">${legend}</div>
  </div>`;
}

export function renderSeverityBars(
  bars: { severity: FailureSeverity; count: number; weight: number }[]
): string {
  const max = Math.max(1, ...bars.map((b) => b.count));
  const colors: Record<string, string> = {
    CRITICAL: "#dc2626",
    HIGH: "#ea580c",
    MEDIUM: "#ca8a04",
    LOW: "#16a34a",
  };
  const rows = bars
    .map((b) => {
      const w = Math.round((b.count / max) * 100);
      return `<div class="bar-row">
        <span class="bar-label ${sevClass(b.severity)}">${b.severity}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${w}%;background:${colors[b.severity]}"></div></div>
        <span class="bar-val">${b.count}</span>
      </div>`;
    })
    .join("");
  return `<div class="chart-bars">${rows}</div>`;
}

export function renderHeatmap(
  cells: { module: string; riskScore: number; failures: number }[]
): string {
  if (cells.length === 0) return '<p class="muted">No module risk data.</p>';
  return `<div class="heatmap">${cells
    .slice(0, 12)
    .map((c) => {
      const intensity = Math.min(1, c.riskScore / 100);
      const bg = `rgba(220, 38, 38, ${0.15 + intensity * 0.55})`;
      return `<div class="heat-cell" style="background:${bg}">
        <strong>${esc(c.module)}</strong>
        <span>Risk ${c.riskScore} · ${c.failures} fail</span>
      </div>`;
    })
    .join("")}</div>`;
}
