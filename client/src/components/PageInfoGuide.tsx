import type { ReactNode } from "react";
import "./pageInfo.css";

type PageInfoGuideProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

/** Short on-page guidance (read-only; separate from ℹ field tips and ? Help menu). */
export function PageInfoGuide({ title, children, className }: PageInfoGuideProps) {
  return (
    <aside
      className={`page-info${className ? ` ${className}` : ""}`}
      aria-label={title}
    >
      <p className="page-info-title">{title}</p>
      {children}
    </aside>
  );
}
