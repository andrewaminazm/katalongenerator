import type { ClassifiedEndpoint, LoadModel, PerformanceConfig, PerformanceMode } from "./types.js";

function parseDurationMs(duration: string): number {
  const m = duration.trim().match(/^(\d+)(s|m|h)?$/i);
  if (!m) return 300_000;
  const n = Number(m[1]);
  const unit = (m[2] ?? "s").toLowerCase();
  if (unit === "h") return n * 3_600_000;
  if (unit === "m") return n * 60_000;
  return n * 1000;
}

function parseRampMs(rampUp: string): number {
  return parseDurationMs(rampUp.replace(/ramp/i, "") || "30s");
}

export function buildLoadModel(
  mode: PerformanceMode,
  config: PerformanceConfig,
  endpoints: ClassifiedEndpoint[]
): LoadModel {
  const baseVus = Math.max(1, config.vus);
  const duration = config.duration || "5m";
  const rampUp = config.rampUp || "30s";

  const perCategory = {
    auth: { vus: 0, weight: 0 },
    read: { vus: 0, weight: 0 },
    write: { vus: 0, weight: 0 },
    search: { vus: 0, weight: 0 },
    payment: { vus: 0, weight: 0 },
    default: { vus: 0, weight: 0 },
  };

  for (const ep of endpoints) {
    perCategory[ep.loadCategory].vus += ep.suggestedVus;
    perCategory[ep.loadCategory].weight += 1;
  }

  let totalVus = baseVus;
  let stages: { duration: string; target: number }[] = [];

  switch (mode) {
    case "smoke":
      totalVus = Math.min(3, baseVus);
      stages = [
        { duration: rampUp, target: totalVus },
        { duration, target: totalVus },
      ];
      break;
    case "baseline":
      totalVus = baseVus;
      stages = [
        { duration: rampUp, target: totalVus },
        { duration, target: totalVus },
        { duration: "1m", target: 0 },
      ];
      break;
    case "stress":
      totalVus = Math.max(baseVus, Math.round(baseVus * 2.5));
      stages = [
        { duration: rampUp, target: Math.round(totalVus * 0.4) },
        { duration: "2m", target: Math.round(totalVus * 0.7) },
        { duration, target: totalVus },
        { duration: "2m", target: Math.round(totalVus * 0.5) },
      ];
      break;
    case "spike":
      totalVus = Math.max(baseVus, Math.round(baseVus * 4));
      stages = [
        { duration: rampUp, target: Math.round(totalVus * 0.2) },
        { duration: "30s", target: totalVus },
        { duration: "1m", target: Math.round(totalVus * 0.2) },
        { duration: "2m", target: totalVus },
        { duration: "1m", target: 0 },
      ];
      break;
    case "soak":
      totalVus = baseVus;
      stages = [
        { duration: rampUp, target: totalVus },
        { duration: duration.includes("m") && parseInt(duration) < 30 ? "30m" : duration, target: totalVus },
      ];
      break;
  }

  return { mode, totalVus, duration, rampUp, stages, perCategory };
}

export function jmeterThreadParams(model: LoadModel): {
  threads: number;
  rampSeconds: number;
  durationSeconds: number;
} {
  const rampSeconds = Math.max(1, Math.round(parseRampMs(model.rampUp) / 1000));
  const durationSeconds = Math.max(30, Math.round(parseDurationMs(model.duration) / 1000));
  return {
    threads: model.totalVus,
    rampSeconds,
    durationSeconds: durationSeconds + rampSeconds,
  };
}
