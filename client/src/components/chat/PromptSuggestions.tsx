const DEFAULT_PROMPTS = [
  "Generate login API tests with chained auth",
  "Analyze flaky locators in my active project",
  "Create regression suite for checkout flow",
  "Explain Project Intelligence and Project Analyze",
  "Generate performance smoke strategy for payment APIs",
  "Convert Postman collection to Katalon structure",
  "Fix weak assertions in API tests",
  "Generate reusable login custom keyword",
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
