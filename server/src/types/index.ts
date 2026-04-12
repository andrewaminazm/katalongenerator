export type Platform = "web" | "mobile";

export type GenerateMode = "manual" | "record";

export interface GenerateRequestBody {
  platform: Platform;
  steps: string[];
  locators?: string;
  model?: string;
  stream?: boolean;
  testCaseName?: string;
  /** When `record`, may run headful Playwright or use `recordedPlaywrightScript` from a prior record session. */
  mode?: GenerateMode;
  /** Playwright-style script from the Record tab; when set with `mode: record`, server skips a new recording if `url` is omitted. */
  recordedPlaywrightScript?: string;
  /** When true with `url`, run Playwright to append auto-detected locators (user still wins on label conflict). */
  autoDetectLocators?: boolean;
  /** Page URL for auto locators or for `mode: record` live session. */
  url?: string;
}

export interface JiraCredentialsBody {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface JiraFetchBody {
  issueKey: string;
  /** When all three fields are set, Jira REST API is called. Omit or leave empty for offline demo data. */
  credentials?: JiraCredentialsBody;
}

export interface HistoryEntry {
  id: string;
  createdAt: string;
  platform: Platform;
  model: string;
  testCaseName?: string;
  stepsPreview: string;
  code: string;
}
