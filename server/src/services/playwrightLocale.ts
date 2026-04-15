/**
 * Playwright browser locale + navigation URL so extracted visible text matches
 * the page language (English vs Arabic). Previously ar-SA was hardcoded site-wide.
 */

export type PlaywrightLocaleMode = "auto" | "en" | "ar";

export interface ResolvedPlaywrightLocale {
  locale: string;
  acceptLanguage: string;
  /** URL to pass to page.goto (may add ?hl=en|ar on Google hosts). */
  gotoUrl: string;
}

const EN = { locale: "en-US", acceptLanguage: "en-US,en;q=0.9" };
const AR = { locale: "ar-SA", acceptLanguage: "ar-SA,ar;q=0.9,en;q=0.5" };

function isGoogleHost(host: string): boolean {
  return /\.google\./i.test(host);
}

function applyGoogleHl(href: string, hl: "en" | "ar"): string {
  try {
    const u = new URL(href);
    if (!isGoogleHost(u.hostname)) return href;
    u.searchParams.set("hl", hl);
    return u.toString();
  } catch {
    return href;
  }
}

/**
 * Chooses Playwright `locale`, `Accept-Language`, and (for Google) `hl=` so DOM
 * labels match the intended language. Auto mode uses URL hints (path /ar, hl=,
 * .gov.sa, etc.); otherwise defaults to English.
 */
export function resolvePlaywrightLocale(
  urlStr: string,
  mode: PlaywrightLocaleMode = "auto"
): ResolvedPlaywrightLocale {
  if (mode === "en") {
    return { ...EN, gotoUrl: applyGoogleHl(urlStr, "en") };
  }
  if (mode === "ar") {
    return { ...AR, gotoUrl: applyGoogleHl(urlStr, "ar") };
  }

  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return { ...EN, gotoUrl: urlStr };
  }

  const path = url.pathname.toLowerCase();
  const hlParam = (url.searchParams.get("hl") || url.searchParams.get("lang") || "").toLowerCase();

  let arabic = false;
  if (hlParam === "ar" || hlParam.startsWith("ar-")) arabic = true;
  else if (hlParam === "en" || hlParam.startsWith("en-")) arabic = false;
  else if (/\/ar(\/|$)/.test(path)) arabic = true;
  else if (/\/en(\/|$)/.test(path)) arabic = false;
  else if (/[?&]locale=ar\b/i.test(url.search)) arabic = true;
  else if (url.hostname.toLowerCase().endsWith(".gov.sa")) arabic = true;

  const pack = arabic ? AR : EN;
  const gotoUrl = isGoogleHost(url.hostname)
    ? applyGoogleHl(urlStr, arabic ? "ar" : "en")
    : urlStr;

  return { ...pack, gotoUrl };
}
