export type AriaRole =
  | "textbox"
  | "searchbox"
  | "button"
  | "link"
  | "checkbox"
  | "radio"
  | "combobox"
  | (string & {});

/**
 * Map ARIA role → concrete HTML element(s) to avoid nonsensical text()-based selectors.
 * Values are XPath element tests (no leading //).
 */
export const roleMap: Record<string, string[]> = {
  textbox: ["input", "textarea"],
  searchbox: ["input", "textarea"],
  button: ["button", "input[@type='submit']", "input[@type='button']"],
  link: ["a"],
  checkbox: ["input[@type='checkbox']"],
  radio: ["input[@type='radio']"],
  combobox: ["select", "input"],
};

export function mapRoleToXPathElementTests(role: string | undefined): string[] {
  const r = (role ?? "").trim().toLowerCase();
  if (!r) return [];
  return roleMap[r] ?? [];
}

