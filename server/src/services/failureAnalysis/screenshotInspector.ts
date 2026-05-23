export interface ScreenshotAnalysis {
  insights: string[];
  score: number;
}

/** Rule-based hints from description or log text mentioning visual state. */
export function inspectScreenshotContext(
  screenshotDescription: string | undefined,
  corpus: string
): ScreenshotAnalysis {
  const text = `${screenshotDescription ?? ""}\n${corpus}`.toLowerCase();
  const insights: string[] = [];

  if (/blank\s*page|white\s*screen|empty\s*page/.test(text)) {
    insights.push("Screenshot or logs suggest a blank page — verify navigation URL and login state.");
  }
  if (/spinner|loading|please wait/.test(text)) {
    insights.push("Loading indicator may still be visible — add wait for spinner to disappear.");
  }
  if (/popup|modal|overlay|cookie|consent/.test(text)) {
    insights.push("Blocking popup or modal may be covering the target element.");
  }
  if (/login|sign\s*in|redirect/.test(text)) {
    insights.push("Session may have expired — user was redirected to login.");
  }
  if (/toast|snackbar|alert/.test(text)) {
    insights.push("Transient toast/alert may have shifted layout or blocked interaction.");
  }
  if (/crash|browser\s*closed|tab\s*closed/.test(text)) {
    insights.push("Browser crash or unexpected tab close detected.");
  }

  return {
    insights,
    score: Math.min(1, insights.length * 0.25),
  };
}
