export interface LocatorAnalysis {
  detected: boolean;
  problem: string;
  recommendation: string;
  isDynamic: boolean;
  domChangeLikely: boolean;
  staleElement: boolean;
  hiddenElement: boolean;
  score: number;
}

export function analyzeLocatorFailure(corpus: string): LocatorAnalysis {
  const c = corpus.toLowerCase();
  const detected =
    /nosuchelement|staleelement|elementnotfound|not visible|strict mode|findtestobject|object repository|invalid selector|xpath|css/i.test(
      c
    );

  if (!detected) {
    return {
      detected: false,
      problem: "",
      recommendation: "",
      isDynamic: false,
      domChangeLikely: false,
      staleElement: false,
      hiddenElement: false,
      score: 0,
    };
  }

  const staleElement = /staleelement/i.test(c);
  const hiddenElement = /not visible|hidden|obscured|intercepted/i.test(c);
  const isDynamic = /index|\[\d+\]|nth-child|dynamic|generated id/i.test(c);
  const domChangeLikely = staleElement || /changed|updated|different/i.test(c);

  let problem = "Katalon could not interact with the target test object / locator.";
  if (staleElement) {
    problem = "Element was found but became stale (DOM was updated after the element was located).";
  } else if (hiddenElement) {
    problem = "Element exists in the DOM but is not visible or clickable (overlay, spinner, or hidden state).";
  } else if (isDynamic) {
    problem = "Locator appears to depend on dynamic DOM structure (index-based XPath or generated IDs).";
  }

  const recommendation = isDynamic
    ? "Prefer stable selectors: data-testid, aria-label, or Object Repository objects mapped to semantic names. Avoid index-based XPath."
    : domChangeLikely
      ? "Re-verify the page structure; update Object Repository or use WaitHelper.waitVisible() before interaction."
      : "Validate the Object Repository path and ensure the element is in the expected page state before click/type.";

  return {
    detected: true,
    problem,
    recommendation,
    isDynamic,
    domChangeLikely,
    staleElement,
    hiddenElement,
    score: staleElement ? 0.9 : hiddenElement ? 0.85 : 0.75,
  };
}
