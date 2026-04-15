/**
 * CLI wrapper — logic lives in src/services/playwrightLocatorLines.ts
 *
 * Run: npm run extract-locators -- https://www.gosi.gov.sa/ar
 */
import { extractPlaywrightLocatorLines } from "../src/services/playwrightLocatorLines.js";

async function main(): Promise<void> {
  const url = process.argv[2]?.trim() || process.env.URL?.trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    console.error("Usage: npx tsx scripts/extract-playwright-locators.ts <https://...>");
    process.exit(1);
  }
  const lines = await extractPlaywrightLocatorLines(url);
  console.log(lines.join("\n"));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
