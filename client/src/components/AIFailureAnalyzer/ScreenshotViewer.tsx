export function ScreenshotViewer({
  previewUrl,
  insights,
}: {
  previewUrl: string | null;
  insights?: string[];
}) {
  if (!previewUrl && (!insights || insights.length === 0)) return null;

  return (
    <div className="fa-card">
      <h3>Screenshot insights</h3>
      {previewUrl && (
        <div className="fa-screenshot-wrap">
          <img src={previewUrl} alt="Failure screenshot" className="fa-screenshot" />
        </div>
      )}
      {insights && insights.length > 0 && (
        <ul className="fa-insight-list">
          {insights.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
