import type { FallbackLocator } from "./types.js";

export const DEFAULT_MAX_RETRIES = 3;

export interface TryResult {
  winner: FallbackLocator | null;
  attempts: { locator: FallbackLocator; ok: boolean; message?: string }[];
}

/**
 * Tries locators in order until `tryLocator` returns true or max attempts reached.
 */
export async function tryLocatorsUntilSuccess(
  ordered: FallbackLocator[],
  tryLocator: (loc: FallbackLocator) => Promise<boolean>,
  maxAttempts = DEFAULT_MAX_RETRIES
): Promise<TryResult> {
  const attempts: TryResult["attempts"] = [];
  let winner: FallbackLocator | null = null;
  const slice = ordered.slice(0, maxAttempts);

  for (const loc of slice) {
    try {
      const ok = await tryLocator(loc);
      attempts.push({ locator: loc, ok });
      if (ok) {
        winner = loc;
        break;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      attempts.push({ locator: loc, ok: false, message: msg });
    }
  }

  return { winner, attempts };
}
