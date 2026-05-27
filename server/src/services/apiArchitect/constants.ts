/** Readable boundary sizes — avoid absurd payloads in generated tests */
export const BOUNDARY_STRING_SIZES = {
  short: 256,
  medium: 512,
  long: 1024,
} as const;

export const PERFORMANCE_MAX_MS = 2000;

export const AI_GENERATOR_LABEL = "AI API Automation Architect";
