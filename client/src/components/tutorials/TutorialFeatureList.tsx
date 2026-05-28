import {
  VIDEO_TUTORIAL_CATEGORIES,
  type VideoTutorial,
  type VideoTutorialCategory,
} from "../../data/tutorials/videoCatalog";
import { VideoAvailabilityBadge } from "./VideoEmbed";

type Props = {
  tutorials: VideoTutorial[];
  selectedId: string;
  onSelect: (id: string) => void;
  groupByCategory?: boolean;
};

function groupTutorials(tutorials: VideoTutorial[]): Map<VideoTutorialCategory, VideoTutorial[]> {
  const map = new Map<VideoTutorialCategory, VideoTutorial[]>();
  for (const t of tutorials) {
    const list = map.get(t.category) ?? [];
    list.push(t);
    map.set(t.category, list);
  }
  return map;
}

export function TutorialFeatureList({
  tutorials,
  selectedId,
  onSelect,
  groupByCategory = true,
}: Props) {
  if (tutorials.length === 0) {
    return <p className="vt-list-empty">No lessons match your filters.</p>;
  }

  const renderItem = (video: VideoTutorial) => (
    <li key={video.id}>
      <button
        type="button"
        className={`vt-feature-item${video.id === selectedId ? " vt-feature-item--active" : ""}`}
        onClick={() => onSelect(video.id)}
        aria-current={video.id === selectedId ? "true" : undefined}
      >
        <span className="vt-feature-item-title">{video.title}</span>
        {video.durationLabel && (
          <span className="vt-feature-item-duration">{video.durationLabel}</span>
        )}
        <VideoAvailabilityBadge video={video} />
      </button>
    </li>
  );

  if (!groupByCategory) {
    return (
      <ul className="vt-feature-list" aria-label="Tutorial lessons">
        {tutorials.map(renderItem)}
      </ul>
    );
  }

  const grouped = groupTutorials(tutorials);

  return (
    <nav className="vt-feature-nav" aria-label="Tutorial lessons by category">
      {VIDEO_TUTORIAL_CATEGORIES.map((cat) => {
        const items = grouped.get(cat.id);
        if (!items?.length) return null;
        return (
          <div key={cat.id} className="vt-feature-group">
            <p className="vt-feature-group-title">{cat.label}</p>
            <ul className="vt-feature-list">{items.map(renderItem)}</ul>
          </div>
        );
      })}
    </nav>
  );
}
