import { logError } from "./loggingPatternGenerator.js";
import { captureScreenshotLine } from "./screenshotIntegration.js";
import type { ArchitecturePlan } from "./types.js";

export function wrapTryCatch(
  plan: ArchitecturePlan,
  innerLines: string[],
  indent = "        "
): string[] {
  const out: string[] = [`${indent}try {`];
  for (const l of innerLines) {
    out.push(`${indent}    ${l}`);
  }
  out.push(`${indent}} catch (Exception ex) {`);
  if (plan.intent.features.logging) {
    out.push(logError("ex", indent));
  }
  if (plan.intent.features.screenshot && plan.intent.platform === "web") {
    out.push(captureScreenshotLine(plan, indent));
  }
  out.push(`${indent}    throw ex`);
  out.push(`${indent}}`);
  return out;
}
