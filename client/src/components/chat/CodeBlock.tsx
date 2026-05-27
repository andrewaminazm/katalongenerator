import { useState } from "react";

type Props = {
  code: string;
  language?: string;
};

export function CodeBlock({ code, language }: Props) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <pre className="aiw-code-block" data-lang={language}>
      <button type="button" className="aiw-copy" onClick={onCopy}>
        {copied ? "Copied" : "Copy"}
      </button>
      {code}
    </pre>
  );
}
