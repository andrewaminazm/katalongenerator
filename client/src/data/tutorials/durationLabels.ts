import durations from "./tutorialDurations.json";

/** Human-readable length for sidebar (synced after `npm run tutorials:videos`). */
export function tutorialDurationLabel(id: string): string {
  const sec = (durations as Record<string, number>)[id];
  if (!sec || sec <= 0) return "~45 sec";
  if (sec < 60) return `~${sec} sec`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `~${m}m ${s}s` : `~${m} min`;
}
