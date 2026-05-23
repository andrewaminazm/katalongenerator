import type { ArchitecturePlan } from "./types.js";

/** Inline retry helper when project does not already expose one. */
export function buildRetryHelperClass(): string {
  return `class RetryHelper {

    static void retry(int maxAttempts = 3, long delayMs = 500, Closure action) {
        if (action == null) {
            throw new IllegalArgumentException('action closure is required')
        }
        int attempt = 0
        while (attempt < maxAttempts) {
            try {
                action.call()
                return
            } catch (Exception ex) {
                attempt++
                if (attempt >= maxAttempts) {
                    throw ex
                }
                Thread.sleep(delayMs)
            }
        }
    }
}
`;
}

export function retryCallExpression(plan: ArchitecturePlan, bodyIndent: string, bodyLines: string[]): string[] {
  const retryPath = plan.projectReuse.retryHelper;
  const lines: string[] = [];
  if (retryPath) {
    lines.push(`${bodyIndent}CustomKeywords.'${retryPath}'(3) {`);
  } else {
    lines.push(`${bodyIndent}RetryHelper.retry(3) {`);
  }
  for (const bl of bodyLines) {
    lines.push(`${bodyIndent}    ${bl}`);
  }
  lines.push(`${bodyIndent}}`);
  return lines;
}
