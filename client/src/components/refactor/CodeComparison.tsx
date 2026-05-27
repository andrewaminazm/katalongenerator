type Props = {
  before?: string;
  after?: string;
};

export function CodeComparison({ before, after }: Props) {
  if (!before && !after) return null;
  return (
    <div className="ref-code-compare">
      {before && (
        <div>
          <div className="ref-code-label">Before</div>
          <pre className="ref-code-block">{before}</pre>
        </div>
      )}
      {after && (
        <div>
          <div className="ref-code-label">After (preview)</div>
          <pre className="ref-code-block">{after}</pre>
        </div>
      )}
    </div>
  );
}
