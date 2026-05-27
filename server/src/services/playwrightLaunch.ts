import type { LaunchOptions } from "playwright";

/**
 * Whether Playwright should launch headless.
 * Headed mode needs a display (local dev with X11/Wayland). Cloud/Linux servers always use headless.
 *
 * Override: PLAYWRIGHT_HEADLESS=true|false (false is ignored when DISPLAY is unset).
 */
export function shouldLaunchPlaywrightHeadless(): boolean {
  const env = process.env.PLAYWRIGHT_HEADLESS?.trim().toLowerCase();
  if (env === "1" || env === "true" || env === "yes") return true;
  if (env === "0" || env === "false" || env === "no") {
    if (process.env.DISPLAY || process.env.WAYLAND_DISPLAY) return false;
    return true;
  }
  if (process.env.CI === "true" || process.env.CI === "1") return true;
  if (process.env.RENDER) return true;
  if (process.env.NODE_ENV === "production") return true;
  if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return true;
  return false;
}

/** Shared Chromium launch options for Docker, Render, and local dev. */
export function getPlaywrightLaunchOptions(): LaunchOptions {
  const headless = shouldLaunchPlaywrightHeadless();
  return {
    headless,
    ...(headless
      ? {
          args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        }
      : {}),
  };
}
