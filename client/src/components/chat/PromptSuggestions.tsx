const DEFAULT_PROMPTS = [
  "Generate automation for login with URL and step lines",
  "Create a test script for checkout with verify steps",
  "Generate a custom keyword for login with username and password",
  "Create a groovy function for date formatting",
  "Build a utility class for Excel test data",
  "Generate a framework helper for retrying flaky clicks",
  "Create a page object for the login page",
  "Create an API helper for bearer token REST calls",
  "Build a DB utility for Oracle SELECT verification",
  "Generate a framework service for session token storage",
] as const;

type Props = {
  suggestions: string[];
  onPick: (text: string) => void;
  disabled?: boolean;
};

export function PromptSuggestions({ suggestions, onPick, disabled }: Props) {
  const items = suggestions.length > 0 ? suggestions : [...DEFAULT_PROMPTS];

  return (
    <div className="aiw-suggestions" role="group" aria-label="Suggested prompts">
      {items.slice(0, 6).map((s) => (
        <button
          key={s}
          type="button"
          className="aiw-suggestion-chip"
          disabled={disabled}
          onClick={() => onPick(s)}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
