import { useState } from "react";

type Props = {
  text: string;
  label?: string;
};

export function CopyCodeButton({ text, label = "Copy" }: Props) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <button type="button" className="htu-copy-btn" onClick={onCopy} aria-label={`Copy: ${text.slice(0, 40)}`}>
      {copied ? "Copied" : label}
    </button>
  );
}
